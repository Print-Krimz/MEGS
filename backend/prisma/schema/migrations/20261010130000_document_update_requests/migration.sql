ALTER TABLE "ComplianceRequirement"
  ADD COLUMN "updateRequestedAt" TIMESTAMP(3),
  ADD COLUMN "updateRequestReason" TEXT,
  ADD COLUMN "updateRequestDeadline" TIMESTAMP(3),
  ADD COLUMN "updateRequestCompletedAt" TIMESTAMP(3);
