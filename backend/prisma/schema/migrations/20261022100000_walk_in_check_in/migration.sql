-- Walk-in self check-in: an applicant scans the MEGS poster QR and types their own details.
-- No User or Application exists until a TA confirms the check-in at the desk.
-- Additive only.

CREATE TYPE "WalkInCheckInStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

ALTER TABLE "Application" ADD COLUMN "selfEncoded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "WalkInCheckIn" (
  "id"            SERIAL PRIMARY KEY,
  "publicId"      TEXT NOT NULL,
  -- Manila calendar day and the per-day number shown as A-001.
  "queueDate"     DATE NOT NULL,
  "queueSeq"      INTEGER NOT NULL,
  "jobPostingId"  INTEGER NOT NULL,
  "firstName"     TEXT NOT NULL,
  "middleName"    TEXT,
  "lastName"      TEXT NOT NULL,
  "mobileNumber"  TEXT,
  "birthDate"     DATE NOT NULL,
  "status"        "WalkInCheckInStatus" NOT NULL DEFAULT 'PENDING',
  -- sha256 of the token in the applicant's phone link. The raw token is never stored.
  "viewTokenHash" TEXT NOT NULL,
  "confirmedById" TEXT,
  "applicationId" INTEGER,
  "dismissedById" TEXT,
  "dismissReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"     TIMESTAMP(3) NOT NULL,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalkInCheckIn_jobPostingId_fkey"
    FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "WalkInCheckIn_confirmedById_fkey"
    FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WalkInCheckIn_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WalkInCheckIn_dismissedById_fkey"
    FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WalkInCheckIn_publicId_key" ON "WalkInCheckIn"("publicId");
CREATE UNIQUE INDEX "WalkInCheckIn_applicationId_key" ON "WalkInCheckIn"("applicationId");
-- Two check-ins at the same moment cannot take the same number; the service retries on conflict.
CREATE UNIQUE INDEX "WalkInCheckIn_queueDate_queueSeq_key" ON "WalkInCheckIn"("queueDate", "queueSeq");
CREATE INDEX "WalkInCheckIn_status_expiresAt_idx" ON "WalkInCheckIn"("status", "expiresAt");
