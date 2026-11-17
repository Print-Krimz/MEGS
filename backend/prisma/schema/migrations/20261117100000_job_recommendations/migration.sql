-- Job recommendations: stored job vectors, applicant alert preferences, sent/dismissed log.
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
ALTER TABLE "JobPosting" ADD COLUMN IF NOT EXISTS "embeddingTextHash" TEXT;

ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "expectedMonthlySalary" INTEGER;
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "jobAlertEmail" TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "jobAlertSms" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "jobAlertConsentAt" TIMESTAMP(3);
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "jobAlertLastSentAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "JobRecommendationEvent" (
  "id" SERIAL NOT NULL,
  "userId" TEXT NOT NULL,
  "jobPostingId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobRecommendationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "JobRecommendationEvent_userId_jobPostingId_kind_key" ON "JobRecommendationEvent"("userId", "jobPostingId", "kind");
CREATE INDEX IF NOT EXISTS "JobRecommendationEvent_userId_kind_idx" ON "JobRecommendationEvent"("userId", "kind");
CREATE INDEX IF NOT EXISTS "JobRecommendationEvent_jobPostingId_idx" ON "JobRecommendationEvent"("jobPostingId");
ALTER TABLE "JobRecommendationEvent" ADD CONSTRAINT "JobRecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobRecommendationEvent" ADD CONSTRAINT "JobRecommendationEvent_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
