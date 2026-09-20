import prisma from '../../utils/prisma.js';

export interface PaginatedNotificationsResult {
  items: any[];
  notifications: any[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const getNotificationsService = async (
  userId: string,
  limit: number,
  cursor?: number,
  isRead?: boolean,
  page?: number
): Promise<PaginatedNotificationsResult> => {
  const where = {
    userId,
    ...(isRead !== undefined ? { isRead } : {}),
  };

  const take = limit > 0 ? limit : 20;
  let skip = 0;
  if (page && page > 0) {
    skip = (page - 1) * take;
  } else if (cursor) {
    skip = 1;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      take,
      skip,
      cursor: cursor && !page ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return {
    items: notifications,
    notifications,
    total,
    unreadCount,
    page: page || 1,
    pageSize: take,
    totalPages,
  };
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

export const markAllAsReadService = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { count: result.count };
};
