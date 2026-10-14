-- Additive: explicit TA ownership of clients and requisitions (MRFs).
-- Backfill rules:
--   MRF.assignedTaId    = createdById when the creator is a Talent Acquisition user, otherwise NULL.
--   Client.assignedTaId = the TA who owns the most of its MRFs (ties go to the lowest user id), otherwise NULL.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "assignedTaId" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "assignedTaId" TEXT;

CREATE INDEX IF NOT EXISTS "Client_assignedTaId_idx" ON "Client"("assignedTaId");
CREATE INDEX IF NOT EXISTS "ManpowerRequest_assignedTaId_idx" ON "ManpowerRequest"("assignedTaId");

ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedTaId_fkey"
  FOREIGN KEY ("assignedTaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManpowerRequest" ADD CONSTRAINT "ManpowerRequest_assignedTaId_fkey"
  FOREIGN KEY ("assignedTaId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ManpowerRequest" m
SET "assignedTaId" = m."createdById"
FROM "User" u
WHERE u."id" = m."createdById" AND u."role" = 'TALENT_ACQUISITION' AND m."assignedTaId" IS NULL;

UPDATE "Client" c
SET "assignedTaId" = pick."assignedTaId"
FROM (
  SELECT DISTINCT ON ("clientId") "clientId", "assignedTaId"
  FROM (
    SELECT "clientId", "assignedTaId", count(*) AS n
    FROM "ManpowerRequest"
    WHERE "assignedTaId" IS NOT NULL
    GROUP BY "clientId", "assignedTaId"
  ) counted
  ORDER BY "clientId", n DESC, "assignedTaId"
) pick
WHERE pick."clientId" = c."id" AND c."assignedTaId" IS NULL;
