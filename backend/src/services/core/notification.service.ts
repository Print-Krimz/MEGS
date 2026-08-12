import prisma from '../../utils/prisma.js';

export const getNotificationsService = async (userId: string, limit: number, cursor?: number) => {
  return await prisma.notification.findMany({
    where: { userId },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
  });
};

export const getUnreadCountService = async (userId: string) => {
  return await prisma.notification.count({
    where: { userId, isRead: false },
  });
};

export const markAsReadService = async (userId: string, notifId: number) => {
  const existing = await prisma.notification.findUnique({ where: { id: notifId } });
  if (!existing) throw new Error("Notification not found");
  if (existing.userId !== userId) throw new Error("Unauthorized");

  return await prisma.notification.update({
    where: { id: notifId },
    data: { isRead: true },
  });
};
