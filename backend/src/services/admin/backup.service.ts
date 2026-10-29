import { BACKUP_TABLES, MaintenanceCancelledError, collectBackupTables, restoreBackupTables, type BackupProgress } from "./backup-tables.js";
import crypto from "crypto";
import zlib from "zlib";
import { Readable } from "stream";
import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import supabase from "../../utils/supabase.js";
import { logAudit } from "../../utils/audit.js";
import { assertBackupExpandedSize, assertBackupFileSize, decompressBackupPayload, validateBackupStructure, MAX_BACKUP_BYTES } from "../../security/backup-limits.js";
import {
  decryptBackupPayload,
  encryptBackupPayload,
} from "../../security/backup-crypto.js";

const BACKUP_BUCKET = "system-backups";
const verifiedBuckets = new Set<string>();

const gzipAsync = (buffer: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    zlib.gzip(buffer, { level: 9 }, (error, compressed) => {
      if (error) reject(error);
      else resolve(compressed);
    });
  });

export const ensureBackupBucketExists = async (): Promise<void> => {
  if (verifiedBuckets.has(BACKUP_BUCKET)) return;
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
    if (listErr) throw new Error("Unable to verify private backup storage");
    const existing = (buckets || []).find((b) => (b.id || b.name) === BACKUP_BUCKET);
    if (existing?.public) throw new Error("Backup storage bucket must be private");
    if (!existing) {
      const { error: createErr } = await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
      });
      if (createErr) throw new Error("Unable to create private backup storage");
    }
    verifiedBuckets.add(BACKUP_BUCKET);
};

const sanitizeBackupName = (rawName: string): string => {
  let clean = rawName
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!clean) {
    clean = "backup";
  }
  return clean;
};

export interface BackupDownloadResult {
  stream: Readable;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// Runs report progress as they go; one that has been silent this long belongs
// to a crashed or restarted server.
const STALE_JOB_MS = 3 * 60 * 1000;
const PROGRESS_WRITE_INTERVAL_MS = 5000;

export class MaintenanceBusyError extends Error {
  statusCode = 409;
  constructor() { super("A backup or restore is already running. Please wait for it to finish."); }
}

// Throttled progress writer; the write also bumps updatedAt, which is the heartbeat.
const progressReporter = (write: (progress: BackupProgress) => Promise<unknown>) => {
  let lastWrite = 0;
  return async (progress: BackupProgress) => {
    if (Date.now() - lastWrite < PROGRESS_WRITE_INTERVAL_MS) return;
    lastWrite = Date.now();
    await write(progress).catch(() => null);
  };
};

export const sweepStaleJobs = async (db: Pick<typeof prisma, "databaseBackupRecord" | "databaseRestoreRecord"> = prisma) => {
  const where = { status: "IN_PROGRESS" as const, updatedAt: { lt: new Date(Date.now() - STALE_JOB_MS) } };
  const data = {
    status: "FAILED" as const,
    errorMessage: "Stopped responding. The server may have restarted or lost its database connection.",
    completedAt: new Date(),
    progress: Prisma.DbNull,
  };
  await db.databaseBackupRecord.updateMany({ where, data });
  await db.databaseRestoreRecord.updateMany({ where, data });
};

// Cancellation is a request, not a status change: the job stays IN_PROGRESS (and keeps
// blocking new admissions) until its worker notices, stops and rolls back. A worker that
// died is cleared by the stale-job sweep.
export const cancelMaintenance = async (actorId?: string) => {
  const where = { status: "IN_PROGRESS" as const, cancelRequestedAt: null };
  const data = { cancelRequestedAt: new Date() };
  const [backups, restores] = await Promise.all([
    prisma.databaseBackupRecord.updateMany({ where, data }),
    prisma.databaseRestoreRecord.updateMany({ where, data }),
  ]);

  if (actorId && (backups.count > 0 || restores.count > 0)) {
    await logAudit(
      actorId,
      "DATABASE_MAINTENANCE_CANCELLED",
      "DatabaseMaintenance",
      null,
      {
        cancelledBackups: backups.count,
        cancelledRestores: restores.count,
      }
    ).catch(() => null);
  }

  return {
    cancelledBackups: backups.count,
    cancelledRestores: restores.count,
  };
};

export const CANCEL_CHECK_INTERVAL_MS = 2000;

// Returns a function the worker calls between pages/chunks. It reads the job's own row
// (outside any restore transaction) and throws once cancellation was requested.
const cancellationCheck = (kind: "backup" | "restore", id: string) => {
  let lastCheck = 0;
  return async (force = false) => {
    if (!force && Date.now() - lastCheck < CANCEL_CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    const table: any = kind === "backup" ? prisma.databaseBackupRecord : prisma.databaseRestoreRecord;
    const row = await table.findUnique({ where: { id }, select: { cancelRequestedAt: true } }).catch(() => null);
    if (row?.cancelRequestedAt) throw new MaintenanceCancelledError();
  };
};

// Admission check and job creation share one transaction-scoped advisory lock, so two
// simultaneous requests cannot both see "nothing running".
const admitMaintenance = <T>(create: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('megs:maintenance-admission'))`);
    await sweepStaleJobs(tx);
    const [backups, restores] = await Promise.all([
      tx.databaseBackupRecord.count({ where: { status: "IN_PROGRESS" } }),
      tx.databaseRestoreRecord.count({ where: { status: "IN_PROGRESS" } }),
    ]);
    if (backups || restores) throw new MaintenanceBusyError();
    return create(tx);
  }, { maxWait: 10_000, timeout: 15_000 });

type BackupType = "MANUAL" | "SCHEDULED_ROUTINE";

export const triggerDatabaseBackupRoutine = async (
  initiatedById?: string,
  backupType: BackupType = "MANUAL",
  customName?: string
) => {
  const backupRecord = await admitMaintenance((tx) => createBackupRecord(tx, initiatedById, backupType, customName));
  return runDatabaseBackup(backupRecord, initiatedById, backupType);
};

// Starts the backup without waiting for it; callers poll the backup list for the result.
export const startDatabaseBackupInBackground = async (
  initiatedById?: string,
  backupType: BackupType = "MANUAL",
  customName?: string
) => {
  const backupRecord = await admitMaintenance((tx) => createBackupRecord(tx, initiatedById, backupType, customName));
  runDatabaseBackup(backupRecord, initiatedById, backupType).catch((err) => {
    console.error(`[Backup] ${backupRecord.filename} failed:`, err?.message || err);
  });
  return backupRecord;
};

const createBackupRecord = async (
  db: Pick<Prisma.TransactionClient, "databaseBackupRecord">,
  initiatedById: string | undefined,
  backupType: BackupType,
  customName?: string
) => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);

  const filename = `megs_backup_${timestamp}_${crypto.randomUUID()}.enc.gz`;

  return db.databaseBackupRecord.create({
    data: {
      filename,
      displayName: customName?.trim() || null,
      status: "IN_PROGRESS",
      backupType,
      initiatedById: initiatedById || null,
      encryptionMethod: "AES-256-GCM",
      tablesIncluded: [],
    },
  });
};

const runDatabaseBackup = async (
  backupRecord: { id: string; filename: string },
  initiatedById: string | undefined,
  backupType: BackupType
) => {
  const startTime = Date.now();
  const { filename } = backupRecord;

  try {
    await ensureBackupBucketExists();

    // Read a complete, consistent snapshot. Failed reads fail the backup.
    const reportProgress = progressReporter((progress) =>
      prisma.databaseBackupRecord.update({ where: { id: backupRecord.id }, data: { progress } })
    );
    const checkCancelled = cancellationCheck("backup", backupRecord.id);
    const data = await collectBackupTables(prisma, reportProgress, { beforePage: () => checkCancelled() });
    const tablesIncluded = BACKUP_TABLES.map(([, model]) => model);
    const snapshotPayload = {
      meta: {
        version: "1.1.0", system: "MEGS Recruitment Management System",
        exportedAt: new Date().toISOString(), backupType,
        tablesCount: tablesIncluded.length,
        recordCounts: Object.fromEntries(BACKUP_TABLES.map(([key, model]) => [model, data[key].length])),
      },
      data,
    };
    // Step 3: Serialize and Gzip Compress
    const jsonString = JSON.stringify(snapshotPayload, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    );
    // Restore rejects anything over its limits, so refuse to save such a file.
    assertBackupExpandedSize(Buffer.byteLength(jsonString, "utf-8"));
    const compressedBuffer = await gzipAsync(Buffer.from(jsonString, "utf-8"));

    // Step 4: AES-256-GCM Encryption
    const finalEncryptedFileBuffer = encryptBackupPayload(compressedBuffer);
    assertBackupFileSize(finalEncryptedFileBuffer.length);

    // Step 5: Calculate SHA-256 Checksum
    const checksumSha256 = crypto
      .createHash("sha256")
      .update(finalEncryptedFileBuffer)
      .digest("hex");

    // Step 6: Upload directly to Supabase Storage
    await checkCancelled(true);
    const storagePath = filename;
    let { error: uploadErr } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(storagePath, finalEncryptedFileBuffer, {
        contentType: "application/gzip",
        upsert: true,
      });

    if (
      uploadErr &&
      (uploadErr.message?.toLowerCase().includes("not found") ||
        (uploadErr as any).statusCode === "404" ||
        (uploadErr as any).status === 404 ||
        (uploadErr as any).status === 400)
    ) {
      console.warn(`[Storage] Bucket '${BACKUP_BUCKET}' not found or uninitialized. Force-creating and retrying upload...`);
      await supabase.storage.createBucket(BACKUP_BUCKET, {
        public: false,
      });
      verifiedBuckets.add(BACKUP_BUCKET);

      const retryResult = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(storagePath, finalEncryptedFileBuffer, {
          contentType: "application/gzip",
          upsert: true,
        });
      uploadErr = retryResult.error;
    }

    if (uploadErr) {
      console.error("Supabase Storage Backup Upload Error:", uploadErr);
      throw new Error(`Failed to upload backup to Supabase Storage: ${uploadErr.message}`);
    }

    const durationMs = Date.now() - startTime;

    // Step 7: Update Backup Record with SUCCESS
    // Conditional: a cancelled, failed or swept job must never become SUCCESS.
    const completed = await prisma.databaseBackupRecord.updateMany({
      where: { id: backupRecord.id, status: "IN_PROGRESS", cancelRequestedAt: null },
      data: {
        status: "SUCCESS",
        sizeBytes: BigInt(finalEncryptedFileBuffer.length),
        checksumSha256,
        storagePath,
        tablesIncluded,
        durationMs,
        progress: Prisma.DbNull,
        completedAt: new Date(),
      },
    });
    if (completed.count === 0) {
      await supabase.storage.from(BACKUP_BUCKET).remove([storagePath]).catch(() => null);
      throw new MaintenanceCancelledError();
    }
    const updatedRecord = await prisma.databaseBackupRecord.findUniqueOrThrow({ where: { id: backupRecord.id } });

    // Step 8: Log Audit Event
    await logAudit(
      initiatedById || null,
      "DATABASE_BACKUP_SUCCESS",
      "DatabaseBackupRecord",
      backupRecord.id,
      {
        filename,
        sizeBytes: finalEncryptedFileBuffer.length,
        checksumSha256,
        durationMs,
        backupType,
        tablesCount: tablesIncluded.length,
      }
    );

    return updatedRecord;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err?.message || "Failed to generate database backup snapshot";

    await prisma.databaseBackupRecord.updateMany({
      where: { id: backupRecord.id, status: "IN_PROGRESS" },
      data: {
        status: "FAILED",
        progress: Prisma.DbNull,
        errorMessage,
        durationMs,
        completedAt: new Date(),
      },
    }).catch(() => null);

    await logAudit(
      initiatedById || null,
      "DATABASE_BACKUP_FAILURE",
      "DatabaseBackupRecord",
      backupRecord.id,
      {
        filename,
        error: errorMessage,
        durationMs,
        backupType,
      }
    );

    throw err;
  }
};

export const listDatabaseBackups = async (limit = 50) => {
  await sweepStaleJobs();

  const records = await prisma.databaseBackupRecord.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      initiatedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return records.map((rec) => ({
    ...rec,
    sizeBytes: rec.sizeBytes ? Number(rec.sizeBytes) : null,
  }));
};

export const renameDatabaseBackup = async (
  backupId: string,
  newName: string,
  actorId?: string
) => {
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record) {
    throw new Error("Database backup record not found.");
  }

  const displayName = newName.trim();

  const updated = await prisma.databaseBackupRecord.update({
    where: { id: backupId },
    data: {
      displayName,
    },
    include: {
      initiatedBy: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  await logAudit(
    actorId || null,
    "DATABASE_BACKUP_RENAMED",
    "DatabaseBackupRecord",
    backupId,
    {
      oldDisplayName: record.displayName,
      newDisplayName: displayName,
    }
  );

  return {
    ...updated,
    sizeBytes: updated.sizeBytes ? Number(updated.sizeBytes) : null,
  };
};

export const getBackupDownloadStream = async (backupId: string, actorId: string): Promise<BackupDownloadResult> => {
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record) {
    throw new Error("Database backup record not found.");
  }

  if (record.status !== "SUCCESS" || !record.storagePath) {
    throw new Error("Requested backup snapshot is not available for download.");
  }

  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(record.storagePath);

  if (error || !data) {
    throw new Error(`Backup snapshot could not be downloaded from Supabase Storage: ${error?.message || "File not found"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const stream = Readable.from(buffer);

  await logAudit(
    actorId,
    "DATABASE_BACKUP_DOWNLOAD",
    "DatabaseBackupRecord",
    record.id,
    {
      filename: record.filename,
      sizeBytes: Number(record.sizeBytes || buffer.length),
      checksumSha256: record.checksumSha256,
    }
  );

  return {
    stream,
    filename: record.displayName ? `${sanitizeBackupName(record.displayName)}.enc.gz` : record.filename,
    contentType: "application/octet-stream",
    sizeBytes: buffer.length,
  };
};

export interface RestoreResult {
  success: boolean;
  recordsRestored: Record<string, number>;
  totalRecords: number;
  durationMs: number;
  restoredAt: string;
}

const decodeBackupBuffer = async (buffer: Buffer): Promise<Record<string, unknown>> => {
  if (!buffer || buffer.length < 29 || buffer.length > MAX_BACKUP_BYTES) {
    throw new Error("Invalid backup file: file is empty, corrupted, or too small.");
  }

  let decompressed: Buffer;

  try {
    const decrypted = decryptBackupPayload(buffer);
    decompressed = await decompressBackupPayload(decrypted);
  } catch (err: any) {
    throw new Error("Failed to decrypt or decompress backup. Invalid key, corrupted file, or tampered data.");
  }

  let snapshot: any;
  try {
    snapshot = JSON.parse(decompressed.toString("utf-8"));
  } catch (err: any) {
    throw new Error("Corrupted backup payload: unable to parse JSON contents.");
  }

  validateBackupStructure(snapshot);

  return snapshot.data;
};

const restoreSnapshotData = async (
  data: Record<string, unknown>,
  initiatedById?: string,
  onProgress?: (progress: BackupProgress) => Promise<void>,
  beforeChunk?: (beforeCommit?: boolean) => Promise<void>
): Promise<RestoreResult> => {
  const startTime = Date.now();
  const { recordsRestored, totalRecords } = await restoreBackupTables(prisma, data, onProgress, beforeChunk);

  const durationMs = Date.now() - startTime;

  await logAudit(
    initiatedById || null,
    "DATABASE_RESTORE_SUCCESS",
    "DatabaseBackupRecord",
    null,
    {
      totalRecords,
      recordsRestored,
      durationMs,
    }
  );

  return {
    success: true,
    recordsRestored,
    totalRecords,
    durationMs,
    restoredAt: new Date().toISOString(),
  };
};

export const restoreDatabaseBackupFromBuffer = async (
  buffer: Buffer,
  initiatedById?: string,
  onProgress?: (progress: BackupProgress) => Promise<void>
): Promise<RestoreResult> => restoreSnapshotData(await decodeBackupBuffer(buffer), initiatedById, onProgress);

const downloadBackupFile = async (storagePath: string) => {
  const { data, error } = await supabase.storage
    .from(BACKUP_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Backup snapshot could not be retrieved from Supabase Storage: ${error?.message || "File not found"}`);
  }

  if (data.size > MAX_BACKUP_BYTES) throw new Error("Backup exceeds supported size limits");
  return Buffer.from(await data.arrayBuffer());
};

export const restoreDatabaseBackupById = async (
  backupId: string,
  initiatedById: string
): Promise<RestoreResult> => {
  await ensureBackupBucketExists();
  const record = await prisma.databaseBackupRecord.findUnique({
    where: { id: backupId },
  });

  if (!record || !record.storagePath) {
    throw new Error("Database backup record not found.");
  }

  return await restoreDatabaseBackupFromBuffer(await downloadBackupFile(record.storagePath), initiatedById);
};

export type RestoreSource = { backupId: string } | { buffer: Buffer; filename: string };

// Validates the request, records the restore and runs it without waiting;
// callers poll the restore list for progress and the result.
export const startRestoreInBackground = async (source: RestoreSource, initiatedById: string) => {
  let filename: string;
  let load: () => Promise<Record<string, unknown>>;

  if ("backupId" in source) {
    const backup = await prisma.databaseBackupRecord.findUnique({ where: { id: source.backupId } });
    if (!backup || backup.status !== "SUCCESS" || !backup.storagePath) {
      throw new Error("Database backup record not found.");
    }
    const storagePath = backup.storagePath;
    filename = backup.filename;
    load = async () => decodeBackupBuffer(await downloadBackupFile(storagePath));
  } else {
    // Reject unreadable uploads before anything is recorded.
    const data = await decodeBackupBuffer(source.buffer);
    filename = source.filename;
    load = async () => data;
  }

  const restoreRecord = await admitMaintenance((tx) => tx.databaseRestoreRecord.create({
    data: {
      status: "IN_PROGRESS",
      source: "backupId" in source ? "BACKUP" : "UPLOAD",
      backupId: "backupId" in source ? source.backupId : null,
      filename,
      initiatedById,
    },
  }));
  const checkCancelled = cancellationCheck("restore", restoreRecord.id);

  const startTime = Date.now();
  const reportProgress = progressReporter((progress) =>
    prisma.databaseRestoreRecord.update({ where: { id: restoreRecord.id }, data: { progress } })
  );

  (async () => {
    try {
      await checkCancelled(true);
      // restoreBackupTables also runs a last check inside the transaction just before
      // commit, so a cancel rolls back; admission is released only after that rollback.
      const result = await restoreSnapshotData(await load(), initiatedById, reportProgress, (beforeCommit) => checkCancelled(beforeCommit));
      const completed = await prisma.databaseRestoreRecord.updateMany({
        where: { id: restoreRecord.id, status: "IN_PROGRESS", cancelRequestedAt: null },
        data: {
          status: "SUCCESS",
          totalRecords: result.totalRecords,
          durationMs: result.durationMs,
          progress: Prisma.DbNull,
          completedAt: new Date(),
        },
      });
      if (completed.count === 0) {
        // Cancel arrived after the restore committed; say so rather than report SUCCESS.
        await prisma.databaseRestoreRecord.updateMany({
          where: { id: restoreRecord.id, status: "IN_PROGRESS" },
          data: {
            status: "FAILED",
            errorMessage: "Cancel arrived after the restore had already been applied. Check the data before retrying.",
            progress: Prisma.DbNull,
            completedAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Failed to restore database backup.";
      const durationMs = Date.now() - startTime;
      console.error(`[Restore] ${filename} failed:`, errorMessage);
      await prisma.databaseRestoreRecord.updateMany({
        where: { id: restoreRecord.id, status: "IN_PROGRESS" },
        data: { status: "FAILED", errorMessage, durationMs, progress: Prisma.DbNull, completedAt: new Date() },
      }).catch(() => null);
      await logAudit(initiatedById, "DATABASE_RESTORE_FAILURE", "DatabaseRestoreRecord", restoreRecord.id, {
        filename,
        error: errorMessage,
        durationMs,
      }).catch(() => null);
    }
  })();

  return restoreRecord;
};

export const listDatabaseRestores = async (limit = 20) => {
  await sweepStaleJobs();
  return prisma.databaseRestoreRecord.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { initiatedBy: { select: { id: true, email: true } } },
  });
};
