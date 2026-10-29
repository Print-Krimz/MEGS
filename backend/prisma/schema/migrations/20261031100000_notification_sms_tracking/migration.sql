-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "smsAt" TIMESTAMP(3),
ADD COLUMN     "smsAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "smsError" TEXT,
ADD COLUMN     "smsProviderId" TEXT,
ADD COLUMN     "smsStatus" TEXT,
ADD COLUMN     "smsText" TEXT;

-- CreateIndex
CREATE INDEX "Notification_smsStatus_createdAt_idx" ON "Notification"("smsStatus", "createdAt");
