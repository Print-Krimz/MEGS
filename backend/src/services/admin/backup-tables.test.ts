import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { MAX_BACKUP_RECORDS } from "../../security/backup-limits.js";
import { BACKUP_TABLES, BACKUP_EXCLUDED_MODELS, BACKUP_ROW_FILTERS, MaintenanceCancelledError, collectBackupTables, formatBackupRow, keysetWhere, restoreBackupTables } from "./backup-tables.js";

const afterId = (where: any): number => where?.OR?.[0]?.id?.gt ?? -1;

describe("workforce backup preservation", () => {
  it("includes every new workforce model without a row cap, paging by primary-key keyset", async () => {
    const findMany = vi.fn(async ({ where, take }: any) => Array.from({ length: Math.max(0, Math.min(take, 501 - (afterId(where) + 1))) }, (_, i) => ({ id: afterId(where) + 1 + i })));
    const db = new Proxy({}, { get: (_t, name) => (name === "complianceDocumentVersion" || name === "deploymentAgreementVersion" ? { findMany } : { findMany: async () => [] }) }) as any;
    const snapshot = await collectBackupTables(db);
    expect(snapshot.complianceDocumentVersions).toHaveLength(501);
    expect(snapshot.deploymentAgreementVersions).toHaveLength(501);
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ id: "asc" }], take: 500 });
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ id: "asc" }], take: 500, where: { OR: [{ id: { gt: 499 } }] } });
    expect(findMany.mock.calls.some(([args]) => "skip" in args)).toBe(false);
    expect(Object.keys(snapshot)).toHaveLength(BACKUP_TABLES.length);
  });

  it("builds composite keyset conditions field by field", () => {
    expect(keysetWhere(["applicantProfileId", "skillId"], { applicantProfileId: 1, skillId: 2, extra: 9 })).toEqual({
      OR: [{ applicantProfileId: { gt: 1 } }, { applicantProfileId: 1, skillId: { gt: 2 } }],
    });
  });

  it("pages composite-key tables by keyset and retries a dropped connection", async () => {
    let failures = 1;
    const findMany = vi.fn(async () => { if (failures-- > 0) throw new Error("Connection terminated unexpectedly"); return []; });
    const db = new Proxy({}, { get: () => ({ findMany }) }) as any;
    vi.useFakeTimers();
    const pending = collectBackupTables(db);
    await vi.runAllTimersAsync();
    await pending;
    vi.useRealTimers();
    expect(findMany).toHaveBeenCalledWith({ orderBy: [{ applicantProfileId: "asc" }, { skillId: "asc" }], take: 500 });
    expect(findMany).toHaveBeenCalledTimes(BACKUP_TABLES.length + 1);
  });

  it("keeps rows that are deleted or inserted between pages from being skipped or repeated", async () => {
    const live = Array.from({ length: 1200 }, (_, i) => ({ id: i + 1 }));
    const findMany = vi.fn(async ({ where, take }: any) => {
      const page = live.filter((row) => row.id > afterId(where)).slice(0, take);
      // A row on the page just read is deleted before the next page is requested.
      if (afterId(where) === -1) live.splice(live.findIndex((row) => row.id === 500), 1);
      return page;
    });
    const db = new Proxy({}, { get: (_t, name) => (name === "user" ? { findMany } : { findMany: async () => [] }) }) as any;
    const { users } = await collectBackupTables(db);
    const ids = users.map((row: any) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(1200);
    expect(ids.slice(-1)[0]).toBe(1200);
  });

  it("collects only reviewed resume parse results", async () => {
    const calls: any[] = [];
    const db = new Proxy({}, { get: (_t, name) => ({ findMany: async (args: any) => { if (name === "resumeParseResult") calls.push(args); return []; } }) }) as any;
    await collectBackupTables(db);
    expect(BACKUP_ROW_FILTERS.ResumeParseResult).toEqual({ reviewedAt: { not: null } });
    expect(calls[0].where).toEqual({ reviewedAt: { not: null } });
  });

  it("stops between pages when cancellation is requested", async () => {
    const findMany = vi.fn(async () => []);
    const db = new Proxy({}, { get: () => ({ findMany }) }) as any;
    let checks = 0;
    await expect(collectBackupTables(db, undefined, { beforePage: () => { if (++checks === 3) throw new MaintenanceCancelledError(); } }))
      .rejects.toBeInstanceOf(MaintenanceCancelledError);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("fails instead of truncating above the restorable row limit, and accepts exactly the limit", async () => {
    const collectUsers = (total: number) => {
      const findMany = vi.fn(async ({ where, take }: any) => Array.from({ length: Math.max(0, Math.min(take, total - (afterId(where) + 1))) }, (_, i) => ({ id: afterId(where) + 1 + i })));
      const db = new Proxy({}, { get: (_t, name) => (name === "user" ? { findMany } : { findMany: async () => [] }) }) as any;
      return collectBackupTables(db);
    };
    expect((await collectUsers(MAX_BACKUP_RECORDS - 1)).users).toHaveLength(MAX_BACKUP_RECORDS - 1);
    expect((await collectUsers(MAX_BACKUP_RECORDS)).users).toHaveLength(MAX_BACKUP_RECORDS);
    await expect(collectUsers(MAX_BACKUP_RECORDS + 1)).rejects.toThrow(/restorable limit/);
  });

  it("accounts for every Prisma model as included or excluded with a reason", () => {
    const included = new Set<string>(BACKUP_TABLES.map(([, model]) => model));
    const all = Prisma.dmmf.datamodel.models.map((model) => model.name);
    expect(all.filter((name) => !included.has(name) && !(name in BACKUP_EXCLUDED_MODELS))).toEqual([]);
    expect(Object.keys(BACKUP_EXCLUDED_MODELS).filter((name) => included.has(name) || !all.includes(name))).toEqual([]);
    for (const reason of Object.values(BACKUP_EXCLUDED_MODELS)) expect(reason.length).toBeGreaterThan(10);
    for (const name of ["ApplicationClosure", "RescheduleRequest", "ResumeParseResult", "WalkInCheckIn"]) expect(included.has(name)).toBe(true);
  });

  it("lists every table after the parents its foreign keys point to", () => {
    const order = BACKUP_TABLES.map(([, model]) => model as string);
    for (const [index, model] of order.entries()) {
      const fields = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === model)!.fields;
      for (const field of fields.filter((candidate) => candidate.relationFromFields?.length && candidate.type !== model)) {
        const parent = order.indexOf(field.type);
        if (parent === -1) continue; // parent not backed up
        expect(parent, `${model}.${field.name} -> ${field.type}`).toBeLessThan(index);
      }
    }
  });

  it("restores snapshots that predate the new tables (missing keys are skipped)", async () => {
    const executed: string[] = [];
    const tx: any = {
      $queryRaw: vi.fn(async (query: any) => query.strings.join("?").includes("pg_attribute")
        ? Prisma.dmmf.datamodel.models.flatMap((model) => model.fields).map((field) => ({ column: field.dbName || field.name, type: "text" }))
        : []),
      $executeRaw: vi.fn(async (query: any) => { executed.push(query.sql); return 1; }),
    };
    const db: any = { $transaction: async (callback: any) => callback(tx) };
    const result = await restoreBackupTables(db, { users: [{ id: "u1" }] });
    expect(result.recordsRestored).toEqual({ User: 1 });
    expect(executed).toHaveLength(1);
  });

  it("restores closures, reschedules, reviewed parse results and check-ins after their parents", async () => {
    const statements: string[] = [];
    const tx: any = {
      $queryRaw: vi.fn(async (query: any) => query.strings.join("?").includes("pg_attribute")
        ? Prisma.dmmf.datamodel.models.flatMap((model) => model.fields).map((field) => ({ column: field.dbName || field.name, type: "text" }))
        : []),
      $executeRaw: vi.fn(async (query: any) => { statements.push(query.sql.match(/INSERT INTO "(\w+)"/)?.[1]); return 1; }),
    };
    const db: any = { $transaction: async (callback: any) => callback(tx) };
    await restoreBackupTables(db, {
      walkInCheckIns: [{ id: 1, publicId: "p", queueDate: "2026-10-01", queueSeq: 1, jobPostingId: 1, firstName: "A", lastName: "B", birthDate: "2000-01-01", status: "PENDING", viewTokenHash: "h", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-02T00:00:00Z" }],
      rescheduleRequests: [{ id: 2, applicationId: 1, activity: "INTERVIEW", reason: "r", previousScheduledAt: "2026-10-01T00:00:00Z", status: "PENDING", requestedById: "u" }],
      resumeParseResults: [{ id: 3, applicantProfileId: 1, source: "TA_REPARSE", status: "PARSED", reviewedAt: "2026-10-01T00:00:00Z", decision: { a: 1 } }],
      applicationClosures: [{ id: 4, applicationId: 1, outcome: "REJECTED", stage: "SCREENING", reasonCode: "x", occurredAt: "2026-10-01T00:00:00Z", recordedById: "u" }],
      applications: [{ id: 1 }],
    });
    expect(statements).toEqual(["Application", "ApplicationClosure", "WalkInCheckIn", "ResumeParseResult", "RescheduleRequest"]);
  });

  it("rolls the whole restore back when a cancel is raised before a chunk or before commit", async () => {
    const tx: any = {
      $queryRaw: vi.fn(async (query: any) => query.strings.join("?").includes("pg_attribute")
        ? Prisma.dmmf.datamodel.models.flatMap((model) => model.fields).map((field) => ({ column: field.dbName || field.name, type: "text" }))
        : []),
      $executeRaw: vi.fn(async () => 1),
    };
    let rolledBack = false;
    const db: any = { $transaction: async (callback: any) => { try { return await callback(tx); } catch (error) { rolledBack = true; throw error; } } };
    await expect(restoreBackupTables(db, { notifications: [{ id: 1 }] }, undefined, (beforeCommit) => { if (beforeCommit) throw new MaintenanceCancelledError(); }))
      .rejects.toBeInstanceOf(MaintenanceCancelledError);
    expect(rolledBack).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    rolledBack = false;
    tx.$executeRaw.mockClear();
    await expect(restoreBackupTables(db, { notifications: [{ id: 1 }] }, undefined, () => { throw new MaintenanceCancelledError(); }))
      .rejects.toBeInstanceOf(MaintenanceCancelledError);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it("retains the new dates, validity, request, and attempt metadata", () => {
    const { data } = formatBackupRow("ComplianceRequirement", {
      id: 1, issuedAt: "2026-10-01", validityStatus: "HAS_EXPIRY", updateRequestReason: "Renew licence", updateRequestDeadline: "2026-10-20",
      documentVersions: [{ id: 123 }], unexpected: "ignored",
    });
    expect(data).toMatchObject({ validityStatus: "HAS_EXPIRY", updateRequestReason: "Renew licence", issuedAt: new Date("2026-10-01"), updateRequestDeadline: new Date("2026-10-20") });
    expect(data).not.toHaveProperty("documentVersions");
    expect(data).not.toHaveProperty("unexpected");
    expect(formatBackupRow("Application", { id: 1, attemptNumber: 2 }).data.attemptNumber).toBe(2);
  });

  const restoreDb = (onExecute: (sql: string, values: unknown[]) => void = () => {}) => {
    const tx: any = {
      // Every column exists, typed as text; the restore casts each value to it.
      $queryRaw: vi.fn(async (query: any) => query.strings.join("?").includes("pg_attribute")
        ? Prisma.dmmf.datamodel.models.flatMap((model) => model.fields).map((field) => ({ column: field.dbName || field.name, type: "text" }))
        : []),
      $executeRaw: vi.fn(async (query: any) => { onExecute(query.sql, query.values); return 1; }),
    };
    return { tx, db: { $transaction: vi.fn(async (callback: any) => callback(tx)) } as any };
  };

  it("restores new records in dependency order with one bulk upsert per table", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const { db, tx } = restoreDb((sql, values) => statements.push({ sql, values }));
    const snapshot = {
      applications: [{ id: 10, attemptNumber: 2 }], employees: [{ id: 1, redeploymentFollowUpAt: "2026-10-20", redeploymentOwnerId: "ta-1" }],
      complianceRequirements: [{ id: 9, issuedAt: "2026-10-01", validityStatus: "NO_EXPIRY" }],
      deployments: [{ id: 7, actualStart: "2026-10-10", actualEnd: "2026-11-10" }],
      complianceDocumentVersions: [{ id: 11, requirementId: 9, documentId: 2, isCurrent: false }],
      deploymentAgreementVersions: [{ id: 13, deploymentId: 7, contractTerms: "Previous agreement" }],
    };
    const result = await restoreBackupTables(db, snapshot);
    expect(result.totalRecords).toBe(6);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(6);
    expect(statements.map((s) => s.sql.match(/INSERT INTO "(\w+)"/)?.[1])).toEqual(["Application", "Employee", "ComplianceRequirement", "Deployment", "ComplianceDocumentVersion", "DeploymentAgreementVersion"]);
    expect(statements[3].sql).toContain('ON CONFLICT ("id") DO UPDATE SET');
    expect(statements[3].values).toContain(new Date("2026-11-10").toISOString());
    expect(statements[4].values).toContain(false);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ timeout: expect.any(Number) }));
  });

  it("chunks large tables, keys composite tables and reports progress", async () => {
    const statements: string[] = [];
    const { db } = restoreDb((sql) => statements.push(sql));
    const onProgress = vi.fn();
    const notifications = Array.from({ length: 1001 }, (_, id) => ({ id, metadata: { n: id } }));
    await restoreBackupTables(db, { notifications, applicantSkills: [{ applicantProfileId: 1, skillId: 2 }] }, onProgress);
    expect(statements.filter((sql) => sql.includes('INSERT INTO "Notification"'))).toHaveLength(3);
    expect(statements.find((sql) => sql.includes('"ApplicantSkill"'))).toContain('ON CONFLICT ("applicantProfileId","skillId") DO NOTHING');
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ table: "Notification", rowsDone: 500, rowsTotal: 1001 }));
  });

  it("fails a restore instead of silently claiming success when a record cannot be written", async () => {
    const { db, tx } = restoreDb();
    tx.$executeRaw.mockRejectedValueOnce(new Error("Missing parent"));
    await expect(restoreBackupTables(db, { deploymentAgreementVersions: [{ id: 13, deploymentId: 7 }] })).rejects.toThrow("Could not restore DeploymentAgreementVersion");
  });

  it("skips check-in data left in backups taken before check-ins were removed", async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    const { db } = restoreDb((sql, values) => statements.push({ sql, values }));
    const result = await restoreBackupTables(db, {
      deployments: [{ id: 7, actualStart: "2026-10-10", nextReviewAt: "2026-11-10" }],
      deploymentReviews: [{ id: 12, deploymentId: 7, notes: "Worker continues" }],
    });
    expect(result.totalRecords).toBe(1);
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).not.toContain("nextReviewAt");
  });
});
