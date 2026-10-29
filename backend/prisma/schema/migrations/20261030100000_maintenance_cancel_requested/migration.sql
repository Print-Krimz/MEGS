-- Persisted cancellation requests for backup/restore jobs. Additive and nullable;
-- leave in place when rolling the application back.
ALTER TABLE "DatabaseBackupRecord" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "DatabaseRestoreRecord" ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
