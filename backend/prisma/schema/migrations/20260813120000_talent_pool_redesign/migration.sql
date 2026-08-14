-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_ATTENTION';

-- CreateEnum
CREATE TYPE "TalentPoolStatus" AS ENUM ('ACTIVE', 'PLACED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CandidateAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TalentPoolContactOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'NO_RESPONSE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "TalentPoolMembership" (
    "id" SERIAL NOT NULL,
    "applicantProfileId" INTEGER NOT NULL,
    "sourceApplicationId" INTEGER,
    "status" "TalentPoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "availability" "CandidateAvailability" NOT NULL DEFAULT 'UNKNOWN',
    "addedById" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "TalentPoolMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TalentPoolContact" (
    "id" SERIAL NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "jobPostingId" INTEGER NOT NULL,
    "recruiterId" TEXT NOT NULL,
    "outcome" "TalentPoolContactOutcome" NOT NULL,
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TalentPoolContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TalentPoolMembership_applicantProfileId_key" ON "TalentPoolMembership"("applicantProfileId");

-- CreateIndex
CREATE INDEX "TalentPoolMembership_status_availability_idx" ON "TalentPoolMembership"("status", "availability");

-- CreateIndex
CREATE INDEX "TalentPoolContact_membershipId_contactedAt_idx" ON "TalentPoolContact"("membershipId", "contactedAt" DESC);

-- CreateIndex
CREATE INDEX "TalentPoolContact_jobPostingId_idx" ON "TalentPoolContact"("jobPostingId");

-- AddForeignKey
ALTER TABLE "TalentPoolMembership" ADD CONSTRAINT "TalentPoolMembership_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolMembership" ADD CONSTRAINT "TalentPoolMembership_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolMembership" ADD CONSTRAINT "TalentPoolMembership_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolContact" ADD CONSTRAINT "TalentPoolContact_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TalentPoolMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolContact" ADD CONSTRAINT "TalentPoolContact_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TalentPoolContact" ADD CONSTRAINT "TalentPoolContact_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
