import prisma from "./prisma.js";
import { EventEmitter } from "events";
import * as mailer from "./mailer.js";
import { isPhilippinePhone, isSyntheticEmail, maskPhoneNumber, sendSmsViaTextBee } from "./sms.js";
import { jobOwnerTaId, type JobOwnerFields } from "../services/ta/ownership.js";

const ROLE_BROADCAST_CONCURRENCY = 8;

// Event bus for streaming notifications to SSE clients.
export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(0);

export interface NotificationEmailOptions {
  sendEmail?: boolean;
  recipientEmail?: string;
  subject?: string;
  ctaText?: string;
  ctaUrl?: string;
  // Unique per alert. A second send with the same key is dropped as a duplicate.
  dedupeKey?: string;
  // Workflow SMS. always = send even when the applicant has a real email; otherwise only phone-only/walk-in applicants.
  sms?: { text: string; always?: boolean };
}

export type NotificationResult = "sent" | "duplicate" | "failed" | "skipped";

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

const SMS_MAX_LENGTH = 160;

// "MEGS: " prefix, ASCII only (keeps it GSM-7 friendly), at most 160 characters.
export const formatSms = (text: string): string => {
  const ascii = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const full = `MEGS: ${ascii}`;
  return full.length <= SMS_MAX_LENGTH ? full : `${full.slice(0, SMS_MAX_LENGTH - 3).trimEnd()}...`;
};

const SMS_QUIET_START_HOUR = 21;
const SMS_QUIET_END_HOUR = 7;
const SMS_DUPLICATE_WINDOW_MS = 10 * 60_000;

const manilaHourFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", hourCycle: "h23" });

// No texts from 9 PM to 7 AM Manila time. They stay QUEUED and the outbox sends them after 7 AM.
export const isSmsQuietHours = (now: Date = new Date()): boolean => {
  const hour = Number(manilaHourFormat.formatToParts(now).find((p) => p.type === "hour")?.value ?? 0) % 24;
  return hour >= SMS_QUIET_START_HOUR || hour < SMS_QUIET_END_HOUR;
};

// First valid Philippine mobile number on the user (account phone, then applicant profile), or null.
export const findSmsPhone = async (userId: string): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true, applicantProfile: { select: { mobileNumber: true } } },
  });
  return (
    [user?.phoneNumber, user?.applicantProfile?.mobileNumber].find(
      (value): value is string => !!value && isPhilippinePhone(value)
    ) ?? null
  );
};

// Sends one text and records the result on the notification. Throws only if a DB update fails.
export const deliverNotificationSms = async (
  notificationId: number,
  phone: string,
  text: string
): Promise<{ success: boolean }> => {
  // Claim the row first: if the result write below fails, it stays SENDING and the outbox never resends it.
  await prisma.notification.update({
    where: { id: notificationId },
    data: { smsStatus: "SENDING", smsText: text, smsAt: new Date(), smsAttempts: { increment: 1 } },
  });
  const result = await sendSmsViaTextBee(phone, text);
  await prisma.notification.update({
    where: { id: notificationId },
    data: result.success
      ? { smsStatus: "SENT", smsProviderId: result.smsBatchId ?? null, smsAt: new Date() }
      : { smsStatus: "FAILED", smsError: (result.error || "SMS failed").slice(0, 200), smsAt: new Date() },
  });
  return { success: result.success };
};

// Sends the workflow SMS for a saved notification and records the result on it. Never throws.
export const dispatchNotificationSms = async (
  notificationId: number,
  userId: string,
  sms: { text: string; always?: boolean }
): Promise<void> => {
  if (process.env.SMS_NOTIFICATIONS_ENABLED !== "true") return;
  let maskedPhone = "";
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;
    if (!sms.always && user.email && !isSyntheticEmail(user.email)) return;

    const phone = await findSmsPhone(userId);
    if (!phone) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { smsStatus: "NO_PHONE", smsAt: new Date() },
      });
      return;
    }

    maskedPhone = maskPhoneNumber(phone);
    const text = formatSms(sms.text);
    const now = new Date();

    const duplicate = await prisma.notification.findFirst({
      where: {
        userId,
        id: { not: notificationId },
        smsText: text,
        smsStatus: { in: ["SENT", "QUEUED"] },
        smsAt: { gte: new Date(now.getTime() - SMS_DUPLICATE_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (duplicate) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { smsStatus: "DUPLICATE", smsText: text, smsAt: now },
      });
      return;
    }

    if (isSmsQuietHours(now)) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { smsStatus: "QUEUED", smsText: text, smsAt: now },
      });
      return;
    }

    await deliverNotificationSms(notificationId, phone, text);
  } catch (err: any) {
    console.error("[NOTIFICATION SMS ERROR]", err?.message || err, { userId, phone: maskedPhone });
  }
};

// Persists notification and emits real-time event to SSE subscribers (fire-and-forget).
export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  emailOptions?: NotificationEmailOptions
): Promise<NotificationResult> => {
  if (!userId || !prisma?.notification?.create) return "skipped";
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
        dedupeKey: emailOptions?.dedupeKey,
      },
    });

    notificationEmitter.emit(`notification:${userId}`, notification);
    if (emailOptions?.sms) void dispatchNotificationSms(notification.id, userId, emailOptions.sms);
  } catch (error) {
    if (isUniqueViolation(error)) return "duplicate";
    console.error("[NOTIFICATION FAILED]", error, { userId, title });
    return "failed";
  }

  if (emailOptions?.sendEmail) {
    void (async () => {
      try {
        let recipientEmail = emailOptions.recipientEmail;
        if (!recipientEmail) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, role: true },
          });
          recipientEmail = user?.email || undefined;
        }

        if (recipientEmail && !isSyntheticEmail(recipientEmail)) {
          const subject = emailOptions.subject || title;
          const html = mailer.buildNotificationEmailHtml({
            title,
            message,
            type,
            ctaText: emailOptions.ctaText,
            ctaUrl: emailOptions.ctaUrl || link || undefined,
          });

          await mailer.sendMail(recipientEmail, subject, message, html);
        }
      } catch (err: any) {
        console.error("[NOTIFICATION EMAIL ERROR]", err?.message || err, { userId, title });
      }
    })();
  }
  return "sent";
};

export type NotificationTally = Record<NotificationResult, number>;

const emptyTally = (): NotificationTally => ({ sent: 0, duplicate: 0, failed: 0, skipped: 0 });

// Sends to every active user with a role, a few at a time. A dedupe key is made per recipient.
const broadcastToRole = async (
  role: "ADMINISTRATOR" | "TALENT_ACQUISITION" | "APPLICANT",
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR",
  link: string | null,
  excludeUserId: string | undefined,
  options: NotificationEmailOptions
): Promise<NotificationTally> => {
  const tally = emptyTally();
  if (!prisma?.user?.findMany) return tally;
  const { dedupeKey, recipientEmail: _recipientEmail, sms: _sms, ...emailOptions } = options;
  try {
    const users = await prisma.user.findMany({
      where: {
        role: role as any,
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    let nextUserIndex = 0;
    const workerCount = Math.min(ROLE_BROADCAST_CONCURRENCY, users.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextUserIndex < users.length) {
        const user = users[nextUserIndex++];
        const result = await sendNotification(user.id, title, message, type, link, {
          ...emailOptions,
          ...(dedupeKey ? { dedupeKey: `${dedupeKey}:${user.id}` } : {}),
        });
        tally[result]++;
      }
    });

    await Promise.all(workers);
  } catch (error) {
    tally.failed++;
    console.error("[ROLE NOTIFICATION FAILED]", error, { role, title });
  }
  return tally;
};

// Broadcasts isolated notifications to all active users with a specific role, optionally excluding actor.
// Returns how many were sent.
export const sendRoleNotification = async (
  role: "ADMINISTRATOR" | "TALENT_ACQUISITION" | "APPLICANT",
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  excludeUserId?: string
): Promise<number> => (await broadcastToRole(role, title, message, type, link, excludeUserId, {})).sent;

// Notifies the owning TA. A null owner (unassigned requisition) goes to the Admins (team leader) instead,
// with the same email options. The actor is never notified about their own action.
export const notifyOwner = async (
  ownerId: string | null,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  options: NotificationEmailOptions & { excludeUserId?: string | null } = {}
): Promise<NotificationTally> => {
  const { excludeUserId, ...sendOptions } = options;
  if (!ownerId) {
    return broadcastToRole("ADMINISTRATOR", title, message, type, link, excludeUserId ?? undefined, sendOptions);
  }
  const tally = emptyTally();
  if (ownerId === excludeUserId) {
    tally.skipped++;
    return tally;
  }
  const { dedupeKey, ...emailOptions } = sendOptions;
  tally[await sendNotification(ownerId, title, message, type, link, {
    ...emailOptions,
    ...(dedupeKey ? { dedupeKey: `${dedupeKey}:${ownerId}` } : {}),
  })]++;
  return tally;
};

// Notifies the TA who owns the job now (see jobOwnerTaId).
export const notifyJobOwner = async (
  job: JobOwnerFields | null | undefined,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  options: NotificationEmailOptions & { excludeUserId?: string | null } = {}
): Promise<NotificationTally> =>
  job ? notifyOwner(jobOwnerTaId(job), title, message, type, link, options) : emptyTally();
