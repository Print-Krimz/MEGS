import prisma from "./prisma.js";
import { EventEmitter } from "events";

// Event bus for streaming notifications to SSE clients.
export const notificationEmitter = new EventEmitter();

// Persists notification and emits real-time event to SSE subscribers (fire-and-forget).
export const sendNotification = async (
  userId: string,
  title: string,
  message: string,
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR" = "INFO",
  link: string | null = null
): Promise<void> => {
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
};
