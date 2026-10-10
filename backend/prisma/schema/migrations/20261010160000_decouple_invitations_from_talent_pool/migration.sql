ALTER TABLE "TalentPoolInvitation" ADD COLUMN IF NOT EXISTS "applicantProfileId" INTEGER;

UPDATE "TalentPoolInvitation" ti
SET "applicantProfileId" = tm."applicantProfileId"
FROM "TalentPoolMembership" tm
WHERE ti."membershipId" = tm."id" AND ti."applicantProfileId" IS NULL;

ALTER TABLE "TalentPoolInvitation" ALTER COLUMN "applicantProfileId" SET NOT NULL;
ALTER TABLE "TalentPoolInvitation" ALTER COLUMN "membershipId" DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TalentPoolInvitation_applicantProfileId_fkey'
  ) THEN
    ALTER TABLE "TalentPoolInvitation" 
    ADD CONSTRAINT "TalentPoolInvitation_applicantProfileId_fkey" 
    FOREIGN KEY ("applicantProfileId") REFERENCES "ApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TalentPoolInvitation_applicantProfileId_status_idx" 
ON "TalentPoolInvitation"("applicantProfileId", "status");
