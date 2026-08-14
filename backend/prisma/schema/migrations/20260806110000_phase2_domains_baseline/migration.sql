-- ─────────────────────────────────────────────────────────────────────────────
-- BASELINE MIGRATION: Phase 2 Domains
-- ─────────────────────────────────────────────────────────────────────────────

-- Enums
DO $$ BEGIN
  CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING_ORIENTATION', 'READY', 'DISPATCHED', 'ACTIVE', 'ENDED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentCategory" AS ENUM ('RESUME', 'PHOTO', 'ASSET', 'POST_HIRE', 'VAULT_201');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DEPLOYED';

-- Client table
CREATE TABLE IF NOT EXISTS "Client" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ManpowerRequest table
CREATE TABLE IF NOT EXISTS "ManpowerRequest" (
    "id" SERIAL PRIMARY KEY,
    "clientId" INTEGER NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "targetFillDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiredSkills" TEXT,
    "requiredExperience" TEXT,
    "requiredEducation" TEXT,
    "requiredCertifications" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Alter JobPosting to add mrfId
DO $$ BEGIN
  ALTER TABLE "JobPosting" ADD COLUMN "mrfId" INTEGER REFERENCES "ManpowerRequest"("id");
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Alter ApplicantProfile to add hasConsentedToAi
DO $$ BEGIN
  ALTER TABLE "ApplicantProfile" ADD COLUMN "hasConsentedToAi" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Deployment table
CREATE TABLE IF NOT EXISTS "Deployment" (
    "id" SERIAL PRIMARY KEY,
    "applicationId" INTEGER NOT NULL REFERENCES "Application"("id") ON DELETE RESTRICT,
    "clientId" INTEGER NOT NULL REFERENCES "Client"("id") ON DELETE RESTRICT,
    "mrfId" INTEGER REFERENCES "ManpowerRequest"("id"),
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING_ORIENTATION',
    "site" TEXT,
    "contractStart" TIMESTAMP(3),
    "contractEnd" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Deployment_applicationId_idx" ON "Deployment"("applicationId");
CREATE INDEX IF NOT EXISTS "Deployment_clientId_status_idx" ON "Deployment"("clientId", "status");

-- RecruiterDecision table
CREATE TABLE IF NOT EXISTS "RecruiterDecision" (
    "id" SERIAL PRIMARY KEY,
    "applicationId" INTEGER NOT NULL REFERENCES "Application"("id") ON DELETE RESTRICT,
    "actorId" TEXT NOT NULL REFERENCES "User"("id"),
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RecruiterDecision_applicationId_createdAt_idx" ON "RecruiterDecision"("applicationId", "createdAt");

-- ComplianceRequirement table
CREATE TABLE IF NOT EXISTS "ComplianceRequirement" (
    "id" SERIAL PRIMARY KEY,
    "applicationId" INTEGER NOT NULL REFERENCES "Application"("id") ON DELETE RESTRICT,
    "documentLabel" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "deadline" TIMESTAMP(3),
    "documentId" INTEGER,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT REFERENCES "User"("id"),
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ComplianceRequirement_applicationId_reviewStatus_idx" ON "ComplianceRequirement"("applicationId", "reviewStatus");

-- StoredDocument table
CREATE TABLE IF NOT EXISTS "StoredDocument" (
    "id" SERIAL PRIMARY KEY,
    "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "category" "DocumentCategory" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "applicationId" INTEGER REFERENCES "Application"("id"),
    "profileId" INTEGER REFERENCES "ApplicantProfile"("id")
);
CREATE INDEX IF NOT EXISTS "StoredDocument_ownerId_category_idx" ON "StoredDocument"("ownerId", "category");
CREATE INDEX IF NOT EXISTS "StoredDocument_sha256_idx" ON "StoredDocument"("sha256");

-- NotificationOutbox table
CREATE TABLE IF NOT EXISTS "NotificationOutbox" (
    "id" SERIAL PRIMARY KEY,
    "recipientId" TEXT NOT NULL REFERENCES "User"("id"),
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "NotificationOutbox_status_createdAt_idx" ON "NotificationOutbox"("status", "createdAt");

