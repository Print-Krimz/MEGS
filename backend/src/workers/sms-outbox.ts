import prisma from "../utils/prisma.js";
import { deliverNotificationSms, findSmsPhone, isSmsQuietHours } from "../utils/notification.js";
import { safeLogError } from "../security/errors.js";

const MAX_ATTEMPTS = 2;
const MAX_AGE_MS = 24 * 60 * 60_000;
const BATCH_SIZE = 50;

export type SmsOutboxResult = {
  scannedCount: number;
  sentCount: number;
  failedCount: number;
  noPhoneCount: number;
};

/** Sends texts held back during quiet hours (QUEUED) and retries failed ones (FAILED) up to 2 attempts, for 24 hours. */
export const sendSmsOutbox = async (now: Date = new Date()): Promise<SmsOutboxResult> => {
  const result: SmsOutboxResult = { scannedCount: 0, sentCount: 0, failedCount: 0, noPhoneCount: 0 };
  if (process.env.SMS_NOTIFICATIONS_ENABLED !== "true" || isSmsQuietHours(now)) return result;

  const rows = await prisma.notification.findMany({
    where: {
      smsStatus: { in: ["QUEUED", "FAILED"] },
      smsAttempts: { lt: MAX_ATTEMPTS },
      smsText: { not: null },
      createdAt: { gte: new Date(now.getTime() - MAX_AGE_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, userId: true, smsText: true },
  });
  result.scannedCount = rows.length;

  for (const row of rows) {
    try {
      const phone = await findSmsPhone(row.userId);
      if (!phone) {
        await prisma.notification.update({ where: { id: row.id }, data: { smsStatus: "NO_PHONE", smsAt: now } });
        result.noPhoneCount++;
        continue;
      }
      const { success } = await deliverNotificationSms(row.id, phone, row.smsText as string);
      if (success) result.sentCount++;
      else result.failedCount++;
    } catch (error) {
      result.failedCount++;
      safeLogError(`sms outbox notification ${row.id}`, error);
    }
  }
  return result;
};
