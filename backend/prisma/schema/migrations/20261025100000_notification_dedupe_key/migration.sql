-- Scheduled reminders tag each alert with a dedupe key; the unique index rejects a second copy.
-- Additive only: existing rows keep NULL, and Postgres allows many NULLs in a unique index.

ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
