-- DropIndex
DROP INDEX "Employee_employeeNumber_idx";

-- CreateIndex
CREATE INDEX "WorkExperience_applicantProfileId_idx" ON "WorkExperience"("applicantProfileId");

-- CreateIndex
CREATE INDEX "Education_applicantProfileId_idx" ON "Education"("applicantProfileId");

-- CreateIndex
CREATE INDEX "TrainingCertification_applicantProfileId_idx" ON "TrainingCertification"("applicantProfileId");

-- CreateIndex
CREATE INDEX "CharacterReference_applicantProfileId_idx" ON "CharacterReference"("applicantProfileId");

-- CreateIndex
CREATE INDEX "Deployment_status_contractEnd_idx" ON "Deployment"("status", "contractEnd");

-- CreateIndex
CREATE INDEX "StoredDocument_storagePath_idx" ON "StoredDocument"("storagePath");

-- CreateIndex
CREATE INDEX "JobPosting_status_createdAt_idx" ON "JobPosting"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_mrfId_idx" ON "JobPosting"("mrfId");

-- CreateIndex
CREATE INDEX "JobPosting_postedById_idx" ON "JobPosting"("postedById");

-- CreateIndex
CREATE INDEX "Application_jobPostingId_status_idx" ON "Application"("jobPostingId", "status");

-- CreateIndex
CREATE INDEX "Application_status_updatedAt_idx" ON "Application"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Interview_applicationId_type_isActive_idx" ON "Interview"("applicationId", "type", "isActive");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- CreateIndex
CREATE INDEX "PostHireDocument_applicationId_idx" ON "PostHireDocument"("applicationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

