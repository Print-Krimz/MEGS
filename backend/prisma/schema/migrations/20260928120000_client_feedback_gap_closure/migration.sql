-- AlterTable
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "reviewThresholdDays" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "medicalValidityMonths" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "ageMin" INTEGER;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "ageMax" INTEGER;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "genderPreference" TEXT;
ALTER TABLE "ManpowerRequest" ADD COLUMN IF NOT EXISTS "tattooPolicy" TEXT;

-- AlterTable
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "tattooStatus" TEXT;
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "hasNoShowHistory" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ComplianceRequirement" ADD COLUMN IF NOT EXISTS "toFollowExpectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RecruiterDecision" ADD COLUMN IF NOT EXISTS "isReverted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RecruiterDecision" ADD COLUMN IF NOT EXISTS "revertedAt" TIMESTAMP(3);
