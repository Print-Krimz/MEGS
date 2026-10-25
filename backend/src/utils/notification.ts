import prisma from "./prisma.js";
import { EventEmitter } from "events";
import * as mailer from "./mailer.js";
import { isSyntheticEmail } from "./sms.js";
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
}

export type NotificationResult = "sent" | "duplicate" | "failed" | "skipped";

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

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
  const { dedupeKey, recipientEmail: _recipientEmail, ...emailOptions } = options;
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
