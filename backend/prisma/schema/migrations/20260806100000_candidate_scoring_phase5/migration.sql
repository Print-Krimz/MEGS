-- Phase 5 is additive: legacy labels/files remain unchanged and coordinates are optional.
ALTER TABLE "ApplicantProfile"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "JobPosting"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "ApplicantProfile"
  ADD CONSTRAINT "ApplicantProfile_coordinates_are_valid"
  CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
  );

ALTER TABLE "JobPosting"
  ADD CONSTRAINT "JobPosting_coordinates_are_valid"
  CHECK (
    ("latitude" IS NULL) = ("longitude" IS NULL)
    AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
    AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
  );

CREATE INDEX "Asset_documentType_verificationState_idx"
  ON "Asset"("documentType", "verificationState");

CREATE INDEX "Asset_applicantProfileId_idx"
  ON "Asset"("applicantProfileId");

CREATE INDEX "AuditLog_action_createdAt_idx"
  ON "AuditLog"("action", "createdAt");

-- Preserve every legacy label and map only known, non-sensitive compliance documents.
UPDATE "Asset"
SET "documentType" = CASE
  WHEN "label" ~* '(nbi|national bureau.*investigation)' THEN 'NBI_CLEARANCE'
  WHEN "label" ~* 'police.*clearance' THEN 'POLICE_CLEARANCE'
  WHEN "label" ~* 'barangay.*clearance' THEN 'BARANGAY_CLEARANCE'
  WHEN "label" ~* '(medical|fit.*work|health).*cert' THEN 'MEDICAL_CERTIFICATE'
  WHEN "label" ~* '(professional|prc).*licen[sc]e' THEN 'PROFESSIONAL_LICENSE'
  WHEN "label" ~* '(driver|driving).*licen[sc]e' THEN 'DRIVERS_LICENSE'
  WHEN "label" ~* '(certificate.*employment|employment.*certificate)' THEN 'EMPLOYMENT_CERTIFICATE'
  WHEN "label" ~* '(certificate|certification|training)' THEN 'TRAINING_CERTIFICATE'
  ELSE NULL
END
WHERE "documentType" IS NULL
  AND "label" !~* '(birth|marriage|pregnan|disabil|gender|nationality|passport|religion|race|ethnic)';
