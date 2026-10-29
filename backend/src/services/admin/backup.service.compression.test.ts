import { gzipSync, gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const backupMocks = vi.hoisted(() => {
  const bucket = {
    upload: vi.fn(),
    download: vi.fn(),
  };

  return {
    bucket,
    findMany: vi.fn(),
    backupCreate: vi.fn(),
    backupUpdate: vi.fn(),
    backupUpdateMany: vi.fn(),
    listBuckets: vi.fn(),
    createBucket: vi.fn(),
    from: vi.fn(() => bucket),
    logAudit: vi.fn(),
  };
});

vi.mock("../../utils/prisma.js", () => {
  const db: any = new Proxy({}, {
    get: (_target, model: string) => model === "$transaction"
      ? async (callback: (tx: unknown) => Promise<unknown>) => callback(db)
      : model === "$executeRaw"
        ? async () => 1
      : model === "databaseBackupRecord"
        ? {
            create: backupMocks.backupCreate, update: backupMocks.backupUpdate, updateMany: backupMocks.backupUpdateMany,
            count: async () => 0, findUnique: async () => ({ cancelRequestedAt: null }),
            findUniqueOrThrow: async () => backupMocks.backupUpdate.mock.results.at(-1)?.value,
          }
      : model === "databaseRestoreRecord"
        ? { count: async () => 0, updateMany: async () => ({ count: 0 }) }
        : { findMany: backupMocks.findMany },
  });
  return { default: db };
});

vi.mock("../../utils/supabase.js", () => ({
  default: {
    storage: {
      listBuckets: backupMocks.listBuckets,
      createBucket: backupMocks.createBucket,
      from: backupMocks.from,
    },
  },
}));

vi.mock("../../utils/audit.js", () => ({ logAudit: backupMocks.logAudit }));

import {
  restoreDatabaseBackupFromBuffer,
  triggerDatabaseBackupRoutine,
} from "./backup.service.js";
import { decryptBackupPayload, encryptBackupPayload } from "../../security/backup-crypto.js";
import { BACKUP_TABLES } from "./backup-tables.js";
import { MAX_BACKUP_EXPANDED_BYTES } from "../../security/backup-limits.js";

const originalEncryptionSecret = process.env.BACKUP_ENCRYPTION_SECRET;
const originalEncryptionKeyId = process.env.BACKUP_ENCRYPTION_KEY_ID;

describe("database backup asynchronous compression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BACKUP_ENCRYPTION_SECRET = "isolated-test-backup-secret-32-bytes";
    process.env.BACKUP_ENCRYPTION_KEY_ID = "compression-test";
    backupMocks.findMany.mockResolvedValue([]);
    backupMocks.backupCreate.mockResolvedValue({ id: "backup-test-id" });
    backupMocks.backupUpdateMany.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      await backupMocks.backupUpdate({ data });
      return { count: 1 };
    });
    backupMocks.backupUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "backup-test-id",
      filename: "megs_backup_test.enc.gz",
      ...data,
    }));
    backupMocks.listBuckets.mockResolvedValue({
      data: [{ id: "system-backups" }],
      error: null,
    });
    backupMocks.createBucket.mockResolvedValue({ data: null, error: null });
    backupMocks.bucket.upload.mockResolvedValue({ data: { path: "backup-test" }, error: null });
    backupMocks.logAudit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (originalEncryptionSecret === undefined) delete process.env.BACKUP_ENCRYPTION_SECRET;
    else process.env.BACKUP_ENCRYPTION_SECRET = originalEncryptionSecret;
    if (originalEncryptionKeyId === undefined) delete process.env.BACKUP_ENCRYPTION_KEY_ID;
    else process.env.BACKUP_ENCRYPTION_KEY_ID = originalEncryptionKeyId;
  });

  it("keeps the encrypted gzip backup format while compressing asynchronously", async () => {
    const backup = await triggerDatabaseBackupRoutine("admin-test", "MANUAL", "async-compression");

    expect(backup.status).toBe("SUCCESS");
    expect(backupMocks.bucket.upload).toHaveBeenCalledOnce();

    const [, uploadedPayload, uploadOptions] = backupMocks.bucket.upload.mock.calls[0] as [
      string,
      Buffer,
      { contentType: string },
    ];
    expect(uploadOptions.contentType).toBe("application/gzip");

    const snapshot = JSON.parse(gunzipSync(decryptBackupPayload(uploadedPayload)).toString("utf-8"));
    expect(snapshot.meta.version).toBe("1.1.0");
    expect(snapshot.meta.tablesCount).toBe(BACKUP_TABLES.length);
    expect(snapshot.data.complianceDocumentVersions).toEqual([]);
    expect(snapshot.data.deploymentAgreementVersions).toEqual([]);
    expect(snapshot.data.users).toEqual([]);
    expect(snapshot.data.notifications).toEqual([]);
  });

  it("fails before upload when the expanded JSON exceeds the restorable limit", async () => {
    backupMocks.findMany.mockResolvedValueOnce([{ id: 1, blob: "x".repeat(MAX_BACKUP_EXPANDED_BYTES + 1) }]);
    await expect(triggerDatabaseBackupRoutine("admin-test", "MANUAL", "too-big")).rejects.toThrow(/128 MiB/);
    expect(backupMocks.bucket.upload).not.toHaveBeenCalled();
    expect(backupMocks.backupUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }));
    expect(backupMocks.backupUpdateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SUCCESS" }) }));
  });

  it("restores the existing encrypted gzip snapshot using asynchronous decompression", async () => {
    const snapshot = {
      meta: { version: "1.0.0", tablesCount: 0 },
      data: {},
    };
    const encrypted = encryptBackupPayload(gzipSync(Buffer.from(JSON.stringify(snapshot))));

    const result = await restoreDatabaseBackupFromBuffer(encrypted, "admin-test");

    expect(result.success).toBe(true);
    expect(result.totalRecords).toBe(0);
    expect(result.recordsRestored).toEqual({});
    expect(backupMocks.logAudit).toHaveBeenCalledWith(
      "admin-test",
      "DATABASE_RESTORE_SUCCESS",
      "DatabaseBackupRecord",
      null,
      expect.objectContaining({ totalRecords: 0 }),
    );
  });
});
