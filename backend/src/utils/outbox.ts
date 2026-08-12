import prisma from "./prisma.js";

export const queueEmailOutbox = async (
  recipientId: string,
  subject: string,
  body: string,
  idempotencyKey: string
) => {
  try {
    const existing = await prisma.notificationOutbox.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return existing;
    }

    return await prisma.notificationOutbox.create({
      data: {
        recipientId,
        subject,
        body,
        channel: "EMAIL",
        status: "PENDING",
        idempotencyKey,
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      // Duplicate idempotencyKey
      return await prisma.notificationOutbox.findUnique({ where: { idempotencyKey } });
    }
    throw error;
  }
};
