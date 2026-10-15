-- Reject Applicant / Mark as Backed Out: one closure record per closed application.
-- Outcome (Rejected or Backed Out) and disposition (Talent Pool or Archive) are recorded as facts on the closure;
-- the new REJECTED status is only the pipeline marker. Old ARCHIVED / TALENT_POOL / BACKOUT rows keep working.

-- The new value is not used anywhere in this file, so it is safe inside the migration transaction.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "ClosureOutcome" AS ENUM ('REJECTED', 'BACKED_OUT');
CREATE TYPE "ClosureDisposition" AS ENUM ('TALENT_POOL', 'ARCHIVE');

CREATE TABLE "ApplicationClosure" (
  "id"            SERIAL PRIMARY KEY,
  "applicationId" INTEGER NOT NULL,
  "outcome"       "ClosureOutcome" NOT NULL,
  -- NULL only for legacy rows that were closed before a disposition existed.
  "disposition"   "ClosureDisposition",
  -- The hiring stage the application was in when it was closed.
  "stage"         "ApplicationStatus" NOT NULL,
  "reasonCode"    TEXT NOT NULL,
  "notes"         TEXT,
  "occurredAt"    TIMESTAMP(3) NOT NULL,
  "recordedById"  TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Set when the application is restored; the row stays as history and a new closure becomes allowed.
  "reopenedAt"    TIMESTAMP(3),
  CONSTRAINT "ApplicationClosure_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ApplicationClosure_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ApplicationClosure_applicationId_idx" ON "ApplicationClosure"("applicationId");
CREATE INDEX "ApplicationClosure_outcome_idx" ON "ApplicationClosure"("outcome");
CREATE INDEX "ApplicationClosure_disposition_idx" ON "ApplicationClosure"("disposition");
CREATE INDEX "ApplicationClosure_stage_idx" ON "ApplicationClosure"("stage");
CREATE INDEX "ApplicationClosure_occurredAt_idx" ON "ApplicationClosure"("occurredAt");

-- Duplicate guard: only one live (not reopened) closure per application.
CREATE UNIQUE INDEX "ApplicationClosure_applicationId_live_key"
  ON "ApplicationClosure"("applicationId") WHERE "reopenedAt" IS NULL;

-- Backfill 1: every existing backout becomes a BACKED_OUT closure.
-- Disposition is TALENT_POOL when a talent pool entry was created from that application, otherwise unknown (NULL).
INSERT INTO "ApplicationClosure"
  ("applicationId", "outcome", "disposition", "stage", "reasonCode", "notes", "occurredAt", "recordedById", "createdAt")
SELECT
  b."applicationId",
  'BACKED_OUT',
  CASE WHEN EXISTS (
    SELECT 1 FROM "TalentPoolMembership" m WHERE m."sourceApplicationId" = b."applicationId"
  ) THEN 'TALENT_POOL'::"ClosureDisposition" END,
  b."stage",
  b."reason"::text,
  b."notes",
  b."occurredAt",
  b."recordedById",
  b."createdAt"
FROM "ApplicationBackout" b
WHERE NOT EXISTS (
  SELECT 1 FROM "ApplicationClosure" c WHERE c."applicationId" = b."applicationId" AND c."reopenedAt" IS NULL
);

-- Backfill 2: applications still sitting in ARCHIVED / TALENT_POOL whose latest such move carried a rejection reason
-- code become REJECTED closures. Disposition follows that move. Archived rows without a reason code are left alone.
INSERT INTO "ApplicationClosure"
  ("applicationId", "outcome", "disposition", "stage", "reasonCode", "notes", "occurredAt", "recordedById", "createdAt")
SELECT
  d."applicationId",
  'REJECTED',
  CASE d."toStatus" WHEN 'TALENT_POOL' THEN 'TALENT_POOL'::"ClosureDisposition" ELSE 'ARCHIVE'::"ClosureDisposition" END,
  d."fromStatus"::"ApplicationStatus",
  d."reasonCode",
  d."reason",
  d."createdAt",
  d."actorId",
  d."createdAt"
FROM (
  SELECT DISTINCT ON (r."applicationId") r.*
  FROM "RecruiterDecision" r
  WHERE r."toStatus" IN ('ARCHIVED', 'TALENT_POOL')
    AND r."isReverted" = FALSE
  ORDER BY r."applicationId", r."createdAt" DESC, r."id" DESC
) d
JOIN "Application" a ON a."id" = d."applicationId"
WHERE d."reasonCode" IS NOT NULL
  AND a."status" IN ('ARCHIVED', 'TALENT_POOL')
  -- the stage must be a real hiring stage, not another off-pipeline status
  AND d."fromStatus" IN (SELECT unnest(enum_range(NULL::"ApplicationStatus"))::text)
  AND d."fromStatus" NOT IN ('ARCHIVED', 'TALENT_POOL', 'BACKOUT')
  AND NOT EXISTS (SELECT 1 FROM "ApplicationBackout" b WHERE b."applicationId" = d."applicationId")
  AND NOT EXISTS (
    SELECT 1 FROM "ApplicationClosure" c WHERE c."applicationId" = d."applicationId" AND c."reopenedAt" IS NULL
  );
