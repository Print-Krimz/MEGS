-- Walk-in intake: staff-encoded applications with a printed QR tracking slip,
-- and Talent Pool / Redeployment offer replies recorded without the portal.
-- Additive only: every existing application stays ONLINE and every existing invitation stays PORTAL.

CREATE TYPE "ApplicationSource" AS ENUM ('ONLINE', 'WALK_IN');
CREATE TYPE "InvitationChannel" AS ENUM ('PORTAL', 'SMS_MAGIC_LINK', 'ASSISTED_PHONE', 'IN_PERSON');

ALTER TABLE "Application"
  ADD COLUMN "source"            "ApplicationSource" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "trackingCode"      TEXT,
  -- sha256 of the token printed in the slip QR. The raw token is never stored.
  ADD COLUMN "trackingTokenHash" TEXT;

CREATE UNIQUE INDEX "Application_trackingCode_key" ON "Application"("trackingCode");
CREATE INDEX "Application_source_idx" ON "Application"("source");

ALTER TABLE "TalentPoolInvitation"
  ADD COLUMN "responseChannel"   "InvitationChannel" NOT NULL DEFAULT 'PORTAL',
  -- The TA who recorded a reply given by phone or in person.
  ADD COLUMN "assistedById"      TEXT,
  -- sha256 of the token in the texted offer link; cleared once the link is used.
  ADD COLUMN "responseTokenHash" TEXT,
  ADD CONSTRAINT "TalentPoolInvitation_assistedById_fkey"
    FOREIGN KEY ("assistedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- User.accountStatus is free text; the new 'WALK_IN' value needs no DDL.
