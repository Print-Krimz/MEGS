-- Applicant references now record the company the person works for.
ALTER TABLE "CharacterReference" ADD COLUMN "company" TEXT;
