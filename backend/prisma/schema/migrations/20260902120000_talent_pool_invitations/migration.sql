CREATE TYPE "TalentPoolInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "TalentPoolInvitation" (
    "id" SERIAL NOT NULL,
    "membershipId" INTEGER NOT NULL,
    "jobPostingId" INTEGER NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "TalentPoolInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "declineReason" TEXT,
    "responseNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TalentPoolInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TalentPoolInvitation_membershipId_status_idx" ON "TalentPoolInvitation"("membershipId", "status");
CREATE INDEX "TalentPoolInvitation_jobPostingId_status_idx" ON "TalentPoolInvitation"("jobPostingId", "status");
CREATE INDEX "TalentPoolInvitation_status_createdAt_idx" ON "TalentPoolInvitation"("status", "createdAt" DESC);

ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TalentPoolMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TalentPoolInvitation" ADD CONSTRAINT "TalentPoolInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
