ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "dataPrivacyConsentAt" TIMESTAMP(3);
ALTER TABLE "ApplicantProfile" ADD COLUMN IF NOT EXISTS "dataPrivacyConsentVersion" TEXT;
