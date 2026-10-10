ALTER TABLE "Employee"
  ADD COLUMN "redeploymentAvailableAt" TIMESTAMP(3),
  ADD COLUMN "redeploymentFollowUpAt" TIMESTAMP(3),
  ADD COLUMN "redeploymentNotes" TEXT,
  ADD COLUMN "redeploymentOwnerId" TEXT;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_redeploymentOwnerId_fkey"
  FOREIGN KEY ("redeploymentOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Employee_redeploymentOwnerId_idx" ON "Employee"("redeploymentOwnerId");
