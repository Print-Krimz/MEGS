-- Smart Merge resume review: one row per resume parse (proposal + sha256 cache), plus TA verification on the profile.
-- Additive only.

ALTER TABLE "ApplicantProfile"
  ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "verifiedById"       TEXT,
  ADD COLUMN "verifiedAt"         TIMESTAMP(3);

CREATE TABLE "ResumeParseResult" (
  "id"                 SERIAL NOT NULL,
  "applicantProfileId" INTEGER NOT NULL,
  "documentId"         INTEGER,
  "sha256"             TEXT,
  "source"             TEXT NOT NULL,
  "status"             TEXT NOT NULL,
  "model"              TEXT,
  "latencyMs"          INTEGER,
  "extracted"          JSONB,
  "errorCategory"      TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById"       TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "decision"           JSONB,

  CONSTRAINT "ResumeParseResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResumeParseResult_applicantProfileId_createdAt_idx" ON "ResumeParseResult"("applicantProfileId", "createdAt");
CREATE INDEX "ResumeParseResult_applicantProfileId_sha256_idx" ON "ResumeParseResult"("applicantProfileId", "sha256");

ALTER TABLE "ApplicantProfile" ADD CONSTRAINT "ApplicantProfile_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResumeParseResult" ADD CONSTRAINT "ResumeParseResult_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeParseResult" ADD CONSTRAINT "ResumeParseResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StoredDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResumeParseResult" ADD CONSTRAINT "ResumeParseResult_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
