-- Dynamic Candidate Scoring and KNN Talent Pooling (V1)
-- Server/Prisma is the only V1 access path. These public-schema tables have
-- RLS enabled and no anon/authenticated grants.

CREATE TYPE "CandidateScoringConfigurationScope" AS ENUM ('GLOBAL');
CREATE TYPE "CandidateScoringConfigurationStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');
CREATE TYPE "CandidateScoringDimension" AS ENUM ('SKILLS', 'EXPERIENCE', 'LOCATION', 'COMPLIANCE', 'EDUCATION_CERTIFICATIONS');
CREATE TYPE "CandidateScoreStatus" AS ENUM ('CALCULATED', 'STALE', 'FAILED');
CREATE TYPE "ScoringRevalidationTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ScoringRevalidationTarget" AS ENUM ('CONFIGURATION', 'JOB_POSTING', 'APPLICATION', 'APPLICANT_PROFILE');
CREATE TYPE "AssetVerificationState" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED', 'EXPIRED');

ALTER TABLE "Asset"
  ADD COLUMN "documentType" TEXT,
  ADD COLUMN "verificationState" "AssetVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "verifiedBy" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE TABLE "CandidateScoringConfiguration" (
  "id" SERIAL NOT NULL,
  "scope" "CandidateScoringConfigurationScope" NOT NULL DEFAULT 'GLOBAL',
  "status" "CandidateScoringConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "knnSettings" JSONB NOT NULL,
  "createdById" TEXT,
  "activatedById" TEXT,
  "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateScoringConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateScoringWeight" (
  "id" SERIAL NOT NULL,
  "configurationId" INTEGER NOT NULL,
  "dimension" "CandidateScoringDimension" NOT NULL,
  "weight" DECIMAL(9,4) NOT NULL,
  CONSTRAINT "CandidateScoringWeight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateScore" (
  "id" SERIAL NOT NULL,
  "applicationId" INTEGER NOT NULL,
  "jobPostingId" INTEGER NOT NULL,
  "configurationId" INTEGER NOT NULL,
  "status" "CandidateScoreStatus" NOT NULL DEFAULT 'CALCULATED',
  "skillsScore" DECIMAL(5,2) NOT NULL,
  "experienceScore" DECIMAL(5,2) NOT NULL,
  "locationScore" DECIMAL(5,2) NOT NULL,
  "complianceScore" DECIMAL(5,2) NOT NULL,
  "educationCertificationScore" DECIMAL(5,2) NOT NULL,
  "finalFitScore" DECIMAL(5,2) NOT NULL,
  "knnSimilarity" DECIMAL(6,5),
  "explanation" JSONB NOT NULL,
  "featureSchemaVersion" TEXT NOT NULL,
  "extractionVersion" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staleAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CandidateScore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateFeatureProfile" (
  "id" SERIAL NOT NULL,
  "applicantProfileId" INTEGER NOT NULL,
  "rawFeatures" JSONB NOT NULL,
  "sparseTfidf" JSONB NOT NULL,
  "normalizedCity" TEXT,
  "normalizedProvince" TEXT,
  "normalizedPreferredAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vocabularyVersion" TEXT NOT NULL,
  "featureSchemaVersion" TEXT NOT NULL,
  "extractionVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateFeatureProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScoringRevalidationTask" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "target" "ScoringRevalidationTarget" NOT NULL,
  "applicationId" INTEGER,
  "jobPostingId" INTEGER,
  "applicantProfileId" INTEGER,
  "configurationId" INTEGER NOT NULL,
  "configurationVersion" INTEGER NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "ScoringRevalidationTaskStatus" NOT NULL DEFAULT 'PENDING',
  "leaseExpiresAt" TIMESTAMP(3),
  "claimedBy" TEXT,
  "claimedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "progressCompleted" INTEGER NOT NULL DEFAULT 0,
  "progressTotal" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScoringRevalidationTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CandidateScoringConfiguration_version_key" ON "CandidateScoringConfiguration"("version");
CREATE UNIQUE INDEX "CandidateScoringConfiguration_one_active_global" ON "CandidateScoringConfiguration"("scope") WHERE "scope" = 'GLOBAL' AND "status" = 'ACTIVE';
CREATE INDEX "CandidateScoringConfiguration_scope_status_idx" ON "CandidateScoringConfiguration"("scope", "status");
CREATE UNIQUE INDEX "CandidateScoringWeight_configurationId_dimension_key" ON "CandidateScoringWeight"("configurationId", "dimension");
CREATE INDEX "CandidateScore_applicationId_jobPostingId_configurationId_calculatedAt_idx" ON "CandidateScore"("applicationId", "jobPostingId", "configurationId", "calculatedAt" DESC);
CREATE INDEX "CandidateScore_jobPostingId_status_calculatedAt_idx" ON "CandidateScore"("jobPostingId", "status", "calculatedAt" DESC);
CREATE UNIQUE INDEX "CandidateFeatureProfile_applicantProfileId_key" ON "CandidateFeatureProfile"("applicantProfileId");
CREATE INDEX "CandidateFeatureProfile_featureSchemaVersion_updatedAt_idx" ON "CandidateFeatureProfile"("featureSchemaVersion", "updatedAt");
CREATE UNIQUE INDEX "ScoringRevalidationTask_dedupeKey_key" ON "ScoringRevalidationTask"("dedupeKey");
CREATE INDEX "ScoringRevalidationTask_status_createdAt_idx" ON "ScoringRevalidationTask"("status", "createdAt");

ALTER TABLE "CandidateScoringConfiguration" ADD CONSTRAINT "CandidateScoringConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CandidateScoringConfiguration" ADD CONSTRAINT "CandidateScoringConfiguration_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CandidateScoringWeight" ADD CONSTRAINT "CandidateScoringWeight_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "CandidateScoringConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateScore" ADD CONSTRAINT "CandidateScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateScore" ADD CONSTRAINT "CandidateScore_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateScore" ADD CONSTRAINT "CandidateScore_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "CandidateScoringConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateFeatureProfile" ADD CONSTRAINT "CandidateFeatureProfile_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringRevalidationTask" ADD CONSTRAINT "ScoringRevalidationTask_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringRevalidationTask" ADD CONSTRAINT "ScoringRevalidationTask_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringRevalidationTask" ADD CONSTRAINT "ScoringRevalidationTask_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScoringRevalidationTask" ADD CONSTRAINT "ScoringRevalidationTask_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "CandidateScoringConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CandidateScoringConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateScoringWeight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CandidateFeatureProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScoringRevalidationTask" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "CandidateScoringConfiguration", "CandidateScoringWeight", "CandidateScore", "CandidateFeatureProfile", "ScoringRevalidationTask" FROM anon, authenticated;
REVOKE ALL ON SEQUENCE "CandidateScoringConfiguration_id_seq", "CandidateScoringWeight_id_seq", "CandidateScore_id_seq", "CandidateFeatureProfile_id_seq" FROM anon, authenticated;

WITH configuration AS (
  INSERT INTO "CandidateScoringConfiguration" ("scope", "status", "version", "revision", "knnSettings")
  VALUES ('GLOBAL', 'ACTIVE', 1, 1, '{"defaultK":20,"maximumK":100,"minimumSimilarity":0.5,"includeArchived":true,"excludeRejected":true,"excludeCurrentlyHired":true}'::jsonb)
  RETURNING "id"
)
INSERT INTO "CandidateScoringWeight" ("configurationId", "dimension", "weight")
SELECT configuration."id", weights.dimension::"CandidateScoringDimension", weights.weight::DECIMAL(9,4)
FROM configuration
CROSS JOIN (VALUES
  ('SKILLS', '40.0000'),
  ('EXPERIENCE', '25.0000'),
  ('LOCATION', '15.0000'),
  ('COMPLIANCE', '10.0000'),
  ('EDUCATION_CERTIFICATIONS', '10.0000')
) AS weights(dimension, weight);
