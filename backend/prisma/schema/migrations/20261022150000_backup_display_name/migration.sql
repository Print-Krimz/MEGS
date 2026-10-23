-- Labels can change without moving or replacing the stored recovery file.
ALTER TABLE "DatabaseBackupRecord" ADD COLUMN "displayName" TEXT;
