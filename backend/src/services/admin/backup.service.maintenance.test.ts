import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// In-memory stand-in for the two job tables plus a mutex that mimics
// pg_advisory_xact_lock (held until the admission transaction ends).
const fake = vi.hoisted(() => ({
  backups: [] as any[],
  restores: [] as any[],
  findMany: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  onUpsert: undefined as undefined | (() => Promise<void>),
  rollbackGate: undefined as undefined | Promise<void>,
  logAudit: vi.fn(),
}));

vi.mock("../../utils/prisma.js", () => {
  const matches = (row: any, where: Record<string, any>) => Object.entries(where).every(([key, value]) =>
    key === "updatedAt" ? row.updatedAt < value.lt : value === null ? row[key] == null : row[key] === value);
  const table = (rows: any[], prefix: string) => ({
    count: async ({ where }: any) => rows.filter((row) => matches(row, where)).length,
    create: async ({ data }: any) => {
      const row = { id: `${prefix}-${rows.length + 1}`, cancelRequestedAt: null, updatedAt: new Date(), filename: "f.enc.gz", ...data };
      rows.push(row);
      return row;
    },
    findUnique: async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null,
    update: async ({ where, data }: any) => Object.assign(rows.find((row) => row.id === where.id), data),
    findUniqueOrThrow: async ({ where }: any) => rows.find((row) => row.id === where.id),
    updateMany: async ({ where, data }: any) => {
      const hits = rows.filter((row) => matches(row, where));
      hits.forEach((row) => Object.assign(row, data, { updatedAt: new Date() }));
      return { count: hits.length };
    },
  });

  let locked: Promise<void> = Promise.resolve();
  const columns = () => Prisma.dmmf.datamodel.models.flatMap((model) => model.fields).map((field) => ({ column: field.dbName || field.name, type: "text" }));
  const base: any = {
    databaseBackupRecord: table(fake.backups, "backup"),
    databaseRestoreRecord: table(fake.restores, "restore"),
    $queryRaw: async (query: any) => (query.strings.join("?").includes("pg_attribute") ? columns() : []),
    $executeRaw: async () => { await fake.onUpsert?.(); return 1; },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      let release: (() => void) | undefined;
      const tx = {
        ...base,
        $executeRaw: async (query: any) => {
          if (!query.sql.includes("pg_advisory_xact_lock")) return base.$executeRaw(query);
          const previous = locked;
          locked = new Promise<void>((resolve) => { release = resolve; });
          await previous;
          return 1;
        },
      };
      try { return await callback(tx); }
      catch (error) { if (!release) await fake.rollbackGate; throw error; }
      finally { release?.(); }
    },
  };
  const db: any = new Proxy(base, { get: (target, name: string) => target[name] ?? { findMany: fake.findMany } });
  return { default: db };
});

vi.mock("../../utils/supabase.js", () => ({
  default: {
    storage: {
      listBuckets: async () => ({ data: [{ id: "system-backups" }], error: null }),
      createBucket: async () => ({ error: null }),
      from: () => ({ upload: fake.upload, remove: fake.remove }),
    },
  },
}));
vi.mock("../../utils/audit.js", () => ({ logAudit: fake.logAudit }));

import {
  cancelMaintenance,
  MaintenanceBusyError,
  startDatabaseBackupInBackground,
  startRestoreInBackground,
  sweepStaleJobs,
  triggerDatabaseBackupRoutine,
} from "./backup.service.js";
import { encryptBackupPayload } from "../../security/backup-crypto.js";

const savedSecret = process.env.BACKUP_ENCRYPTION_SECRET;
const savedKeyId = process.env.BACKUP_ENCRYPTION_KEY_ID;

const encryptedSnapshot = (data: Record<string, unknown>) =>
  encryptBackupPayload(gzipSync(Buffer.from(JSON.stringify({ meta: { version: "1.1.0" }, data }))));

describe("database maintenance job lifecycle management", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fake.backups.length = 0;
    fake.restores.length = 0;
    fake.onUpsert = undefined;
    fake.rollbackGate = undefined;
    fake.findMany.mockReset().mockResolvedValue([]);
    fake.upload.mockReset().mockResolvedValue({ error: null });
    fake.remove.mockReset().mockResolvedValue({ error: null });
    fake.logAudit.mockReset().mockResolvedValue(undefined);
    process.env.BACKUP_ENCRYPTION_SECRET = "isolated-test-backup-secret-32-bytes";
    process.env.BACKUP_ENCRYPTION_KEY_ID = "maintenance-test";
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.BACKUP_ENCRYPTION_SECRET; else process.env.BACKUP_ENCRYPTION_SECRET = savedSecret;
    if (savedKeyId === undefined) delete process.env.BACKUP_ENCRYPTION_KEY_ID; else process.env.BACKUP_ENCRYPTION_KEY_ID = savedKeyId;
  });

  it("sweeps stale jobs older than 3 minutes and marks them failed with cleared progress", async () => {
    const old = new Date(Date.now() - 4 * 60 * 1000);
    fake.backups.push({ id: "old", status: "IN_PROGRESS", updatedAt: old, cancelRequestedAt: null });
    fake.restores.push({ id: "fresh", status: "IN_PROGRESS", updatedAt: new Date(), cancelRequestedAt: null });
    await sweepStaleJobs();
    expect(fake.backups[0]).toMatchObject({ status: "FAILED", errorMessage: expect.stringContaining("Stopped responding") });
    expect(fake.restores[0].status).toBe("IN_PROGRESS");
  });

  it("clears a stale job during admission so a dead worker does not block forever", async () => {
    fake.restores.push({ id: "dead", status: "IN_PROGRESS", updatedAt: new Date(Date.now() - 4 * 60 * 1000), cancelRequestedAt: null });
    fake.upload.mockReturnValue(new Promise(() => {}));
    await startDatabaseBackupInBackground("admin-1");
    expect(fake.restores[0].status).toBe("FAILED");
    expect(fake.backups).toHaveLength(1);
  });

  it("records a cancel request and leaves the job IN_PROGRESS", async () => {
    fake.backups.push({ id: "b", status: "IN_PROGRESS", updatedAt: new Date(), cancelRequestedAt: null });
    fake.restores.push({ id: "r", status: "IN_PROGRESS", updatedAt: new Date(), cancelRequestedAt: null });
    const result = await cancelMaintenance("admin-123");
    expect(result).toEqual({ cancelledBackups: 1, cancelledRestores: 1 });
    for (const row of [fake.backups[0], fake.restores[0]]) {
      expect(row.status).toBe("IN_PROGRESS");
      expect(row.cancelRequestedAt).toBeInstanceOf(Date);
    }
    expect(fake.logAudit).toHaveBeenCalledWith("admin-123", "DATABASE_MAINTENANCE_CANCELLED", "DatabaseMaintenance", null,
      expect.objectContaining({ cancelledBackups: 1, cancelledRestores: 1 }));
    // A second request does not count the same job again.
    expect(await cancelMaintenance("admin-123")).toEqual({ cancelledBackups: 0, cancelledRestores: 0 });
  });

  it("admits only one of two simultaneous requests", async () => {
    fake.findMany.mockReturnValue(new Promise(() => {}));
    const results = await Promise.allSettled([startDatabaseBackupInBackground("a"), startDatabaseBackupInBackground("b")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(MaintenanceBusyError);
    expect(fake.backups).toHaveLength(1);
  });

  it("stops a cancelled backup between pages, saves nothing and never reports SUCCESS", async () => {
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => (now += 3000));
    fake.findMany.mockImplementation(async () => {
      fake.backups[0].cancelRequestedAt = new Date();
      return Array.from({ length: 500 }, (_, id) => ({ id }));
    });
    await expect(triggerDatabaseBackupRoutine("admin-1")).rejects.toThrow("Cancelled by administrator");
    expect(fake.findMany).toHaveBeenCalledTimes(1);
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.backups[0]).toMatchObject({ status: "FAILED", errorMessage: "Cancelled by administrator" });
  });

  it("does not let a cancel that lands during upload become SUCCESS, and removes the file", async () => {
    fake.upload.mockImplementation(async () => { fake.backups[0].cancelRequestedAt = new Date(); return { error: null }; });
    await expect(triggerDatabaseBackupRoutine("admin-1")).rejects.toThrow("Cancelled by administrator");
    expect(fake.backups[0].status).toBe("FAILED");
    expect(fake.remove).toHaveBeenCalledTimes(1);
  });

  it("never overwrites a job that was already failed when the worker finishes", async () => {
    fake.upload.mockImplementation(async () => { Object.assign(fake.backups[0], { status: "FAILED", errorMessage: "Stopped responding." }); return { error: null }; });
    await expect(triggerDatabaseBackupRoutine("admin-1")).rejects.toThrow();
    expect(fake.backups[0]).toMatchObject({ status: "FAILED", errorMessage: "Stopped responding." });
  });

  it("rolls an interrupted restore back before admission is released", async () => {
    let releaseRollback!: () => void;
    fake.rollbackGate = new Promise<void>((resolve) => { releaseRollback = resolve; });
    fake.onUpsert = async () => { await cancelMaintenance("admin-1"); };

    const restore = await startRestoreInBackground({ buffer: encryptedSnapshot({ notifications: [{ id: 1 }] }), filename: "x.enc.gz" }, "admin-1");
    await vi.waitFor(() => expect(fake.restores[0].cancelRequestedAt).toBeInstanceOf(Date));
    // Rollback has not finished: the job still holds admission.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fake.restores[0].status).toBe("IN_PROGRESS");
    await expect(startRestoreInBackground({ buffer: encryptedSnapshot({}), filename: "y.enc.gz" }, "admin-1")).rejects.toBeInstanceOf(MaintenanceBusyError);

    releaseRollback();
    await vi.waitFor(() => expect(fake.restores[0].status).toBe("FAILED"));
    expect(fake.restores[0]).toMatchObject({ id: restore.id, errorMessage: "Cancelled by administrator" });
    // Admission is free again only after the rollback finished.
    fake.onUpsert = undefined;
    await expect(startRestoreInBackground({ buffer: encryptedSnapshot({}), filename: "z.enc.gz" }, "admin-1")).resolves.toBeDefined();
  });
});
