import prisma from "./prisma.js";
import { EventEmitter } from "events";
import * as mailer from "./mailer.js";

// Event bus for streaming notifications to SSE clients.
export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(0);

export interface NotificationEmailOptions {
  sendEmail?: boolean;
  recipientEmail?: string;
  subject?: string;
  ctaText?: string;
  ctaUrl?: string;
}

// Persists notification and emits real-time event to SSE subscribers (fire-and-forget).
export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  emailOptions?: NotificationEmailOptions
): Promise<void> => {
  if (!userId || !prisma?.notification?.create) return;
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });

    notificationEmitter.emit(`notification:${userId}`, notification);
  } catch (error) {
    console.error("[NOTIFICATION FAILED]", error, { userId, title });
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

        if (recipientEmail) {
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
};

// Broadcasts isolated notifications to all active users with a specific role, optionally excluding actor.
export const sendRoleNotification = async (
  role: "ADMINISTRATOR" | "TALENT_ACQUISITION" | "APPLICANT",
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null,
  excludeUserId?: string
): Promise<void> => {
  if (!prisma?.user?.findMany) return;
  try {
    const users = await prisma.user.findMany({
      where: {
        role: role as any,
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });

    await Promise.all(
      users.map((u) => sendNotification(u.id, title, message, type, link))
    );
  } catch (error) {
    console.error("[ROLE NOTIFICATION FAILED]", error, { role, title });
  }
};
