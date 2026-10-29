-- The TA no longer uploads a signed contract scan. Drop the pointer to it.
-- Run after the backend that stopped reading this column is deployed, and after the old
-- CONTRACT scans were purged (see the purge script); the column is just a plain integer, no foreign key.
ALTER TABLE "Application" DROP COLUMN "contractDocumentId";
