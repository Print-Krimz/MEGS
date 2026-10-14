-- Additive: structured backout records plus a structured rejection reason code.
CREATE TYPE "BackoutParty" AS ENUM ('APPLICANT', 'CLIENT', 'AGENCY');

CREATE TYPE "BackoutReason" AS ENUM (
  'NO_SHOW', 'ACCEPTED_OTHER_OFFER', 'SALARY_OR_BENEFITS', 'LOCATION_OR_COMMUTE',
  'FAMILY_OR_PERSONAL', 'HEALTH', 'UNREACHABLE', 'INCOMPLETE_REQUIREMENTS',
  'CLIENT_CANCELLED_REQUEST', 'CLIENT_WITHDREW_SELECTION', 'POSITION_FILLED',
  'AGENCY_PROCESSING_DELAY', 'OTHER'
);

CREATE TABLE "ApplicationBackout" (
  "id" SERIAL NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "deploymentId" INTEGER,
  "stage" "ApplicationStatus" NOT NULL,
  "party" "BackoutParty" NOT NULL,
  "reason" "BackoutReason" NOT NULL,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationBackout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationBackout_applicationId_key" ON "ApplicationBackout"("applicationId");
CREATE INDEX "ApplicationBackout_occurredAt_idx" ON "ApplicationBackout"("occurredAt");
CREATE INDEX "ApplicationBackout_stage_idx" ON "ApplicationBackout"("stage");
CREATE INDEX "ApplicationBackout_party_idx" ON "ApplicationBackout"("party");

ALTER TABLE "ApplicationBackout" ADD CONSTRAINT "ApplicationBackout_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationBackout" ADD CONSTRAINT "ApplicationBackout_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruiterDecision" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
