-- October 27 consultation: applicant reschedule requests, contract signing appointment,
-- interview location split from outcome notes, and a separate client-decision note.
-- Additive only. No existing rows are deleted.

CREATE TYPE "ScheduleActivity" AS ENUM ('INITIAL_SCREENING', 'FINAL_INTERVIEW', 'CONTRACT_SIGNING');
CREATE TYPE "RescheduleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Application" ADD COLUMN "contractSigningAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "contractSigningLocation" TEXT;

ALTER TABLE "Interview" ADD COLUMN "location" TEXT;

ALTER TABLE "ClientEndorsement" ADD COLUMN "decisionNotes" TEXT;

-- Interviews not yet conducted held the meeting details in "notes". Move them to "location"
-- so the outcome dialog starts empty and cannot overwrite them.
UPDATE "Interview"
SET "location" = "notes", "notes" = NULL
WHERE "notes" IS NOT NULL AND ("result" IS NULL OR "result" IN ('PENDING', 'SCHEDULED'));

CREATE TABLE "RescheduleRequest" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "activity" "ScheduleActivity" NOT NULL,
    "interviewId" INTEGER,
    "reason" TEXT NOT NULL,
    "previousScheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "RescheduleStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "newScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RescheduleRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RescheduleRequest_applicationId_activity_status_idx" ON "RescheduleRequest"("applicationId", "activity", "status");

-- At most one pending request per appointment.
CREATE UNIQUE INDEX "RescheduleRequest_one_pending_idx" ON "RescheduleRequest"("applicationId", "activity") WHERE "status" = 'PENDING';

ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescheduleRequest" ADD CONSTRAINT "RescheduleRequest_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Match the RLS posture of the other app tables: the API uses the service role, no direct client access.
ALTER TABLE "RescheduleRequest" ENABLE ROW LEVEL SECURITY;
