import prisma from "../utils/prisma.js";
import { sendMail } from "../utils/mailer.js";

const MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 20000; // 20 seconds

let workerInterval: NodeJS.Timeout | null = null;

let isProcessing = false;

export const processPendingEmails = async () => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const pendingItems = await prisma.notificationOutbox.findMany({
      where: {
        status: "PENDING",
        attempts: { lt: MAX_ATTEMPTS },
      },
      include: {
        recipient: { select: { email: true } },
      },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    for (const item of pendingItems) {
      if (!item.recipient?.email) {
        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            attempts: item.attempts + 1,
            lastError: "Recipient email not found",
          },
        });
        continue;
      }

      try {
        await sendMail(item.recipient.email, item.subject, item.body);
        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: item.attempts + 1,
          },
        });
      } catch (err: any) {
        const nextAttempts = item.attempts + 1;
        await prisma.notificationOutbox.update({
          where: { id: item.id },
          data: {
            attempts: nextAttempts,
            lastError: err.message || "Email sending failed",
            status: nextAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          },
        });
      }
    }
  } finally {
    isProcessing = false;
  }
};

export const startEmailWorker = () => {
  if (workerInterval) return;
  console.log("📧 Email outbox worker started");
  void processPendingEmails().catch((err) => console.error("[EmailWorker] error:", err));
  workerInterval = setInterval(() => {
    void processPendingEmails().catch((err) => console.error("[EmailWorker] error:", err));
  }, POLL_INTERVAL_MS);
};

export const stopEmailWorker = () => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
};
