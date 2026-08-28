-- CreateTable
CREATE TABLE IF NOT EXISTS "UserInvitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserInvitation_tokenHash_isUsed_idx" ON "UserInvitation"("tokenHash", "isUsed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserInvitation_email_isUsed_idx" ON "UserInvitation"("email", "isUsed");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserInvitation_userId_isUsed_idx" ON "UserInvitation"("userId", "isUsed");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserInvitation_userId_fkey') THEN
        ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
