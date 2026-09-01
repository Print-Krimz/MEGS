-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'CONTRACT_AND_ORIENTATION';

-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "contractSigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "contractSignedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "contractDocumentUrl" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "contractNotes" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "orientationCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "orientationCompletedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "orientationDate" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "orientationNotes" TEXT;
