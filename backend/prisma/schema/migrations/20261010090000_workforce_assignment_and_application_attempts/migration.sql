-- Separate planned agreement dates from actual attendance dates.
ALTER TABLE "Deployment"
  ADD COLUMN "actualStart" TIMESTAMP(3),
  ADD COLUMN "actualEnd" TIMESTAMP(3),
  ADD COLUMN "nextReviewAt" TIMESTAMP(3);

-- Preserve every application attempt while allowing a candidate to reapply
-- after a previous attempt has ended.
ALTER TABLE "Application"
  ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Application" DROP CONSTRAINT IF EXISTS "Application_userId_jobPostingId_key";
DROP INDEX IF EXISTS "Application_userId_jobPostingId_key";

CREATE UNIQUE INDEX "Application_userId_jobPostingId_attemptNumber_key"
  ON "Application"("userId", "jobPostingId", "attemptNumber");

CREATE INDEX "Application_userId_jobPostingId_createdAt_idx"
  ON "Application"("userId", "jobPostingId", "createdAt" DESC);

CREATE TYPE "DocumentValidityStatus" AS ENUM ('UNKNOWN', 'HAS_EXPIRY', 'NO_EXPIRY');

ALTER TABLE "ComplianceRequirement"
  ADD COLUMN "issuedAt" TIMESTAMP(3),
  ADD COLUMN "validityStatus" "DocumentValidityStatus" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "ComplianceRequirement"
SET "validityStatus" = 'HAS_EXPIRY'
WHERE "expiresAt" IS NOT NULL;

CREATE TABLE "ComplianceDocumentVersion" (
  "id" SERIAL NOT NULL,
  "requirementId" INTEGER NOT NULL,
  "documentId" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "validityStatus" "DocumentValidityStatus" NOT NULL DEFAULT 'UNKNOWN',
  "reviewStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reviewNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ComplianceDocumentVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComplianceDocumentVersion_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "ComplianceRequirement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ComplianceDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StoredDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ComplianceDocumentVersion_requirementId_documentId_key"
  ON "ComplianceDocumentVersion"("requirementId", "documentId");
CREATE INDEX "ComplianceDocumentVersion_requirementId_uploadedAt_idx"
  ON "ComplianceDocumentVersion"("requirementId", "uploadedAt" DESC);
CREATE INDEX "ComplianceDocumentVersion_documentId_idx"
  ON "ComplianceDocumentVersion"("documentId");

INSERT INTO "ComplianceDocumentVersion"(
  "requirementId", "documentId", "issuedAt", "expiresAt", "validityStatus",
  "reviewStatus", "reviewNotes", "reviewedById", "reviewedAt", "uploadedAt", "isCurrent"
)
SELECT cr."id", cr."documentId", cr."issuedAt", cr."expiresAt", cr."validityStatus",
       cr."reviewStatus", cr."reviewNotes", cr."reviewedById", cr."reviewedAt",
       COALESCE(sd."uploadedAt", cr."createdAt"), true
FROM "ComplianceRequirement" cr
JOIN "StoredDocument" sd ON sd."id" = cr."documentId"
WHERE cr."documentId" IS NOT NULL;

CREATE TABLE "DeploymentReview" (
  "id" SERIAL NOT NULL,
  "deploymentId" INTEGER NOT NULL,
  "reviewedById" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "nextReviewAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "DeploymentReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeploymentReview_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeploymentReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DeploymentReview_deploymentId_reviewedAt_idx"
  ON "DeploymentReview"("deploymentId", "reviewedAt" DESC);
CREATE INDEX "DeploymentReview_nextReviewAt_idx"
  ON "DeploymentReview"("nextReviewAt");

CREATE TABLE "DeploymentAgreementVersion" (
  "id" SERIAL NOT NULL,
  "deploymentId" INTEGER NOT NULL,
  "recordedById" TEXT NOT NULL,
  "contractStart" TIMESTAMP(3),
  "contractEnd" TIMESTAMP(3),
  "contractDocumentUrl" TEXT,
  "contractStatus" TEXT,
  "workerSigned" BOOLEAN NOT NULL,
  "workerSignedAt" TIMESTAMP(3),
  "clientSigned" BOOLEAN NOT NULL,
  "clientSignedAt" TIMESTAMP(3),
  "contractTerms" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeploymentAgreementVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeploymentAgreementVersion_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeploymentAgreementVersion_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "DeploymentAgreementVersion_deploymentId_recordedAt_idx"
  ON "DeploymentAgreementVersion"("deploymentId", "recordedAt" DESC);

