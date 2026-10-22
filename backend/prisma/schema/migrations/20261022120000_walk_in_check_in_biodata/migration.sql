-- Self check-in: the applicant may attach their biodata photo or PDF.
-- The file waits in private storage under check-ins/<publicId>/ until a TA confirms or dismisses the check-in.
-- Additive only.

ALTER TABLE "WalkInCheckIn"
  ADD COLUMN "biodataStoragePath" TEXT,
  ADD COLUMN "biodataMimeType"    TEXT,
  ADD COLUMN "biodataFileName"    TEXT,
  ADD COLUMN "biodataSizeBytes"   INTEGER;
