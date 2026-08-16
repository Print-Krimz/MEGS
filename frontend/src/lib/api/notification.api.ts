import { api } from "./client";
import type { Notification } from "../types/notification.types";

export interface NotificationQueryParams {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export const notificationApi = {
  getNotifications: (params?: NotificationQueryParams) => {
    const searchParams = new URLSearchParams();
    if (params?.isRead !== undefined) searchParams.append("isRead", String(params.isRead));
    if (params?.page) searchParams.append("page", String(params.page));
    if (params?.limit) searchParams.append("limit", String(params.limit));

    const qs = searchParams.toString();
    return api.get<Notification[]>(`/api/notifications${qs ? `?${qs}` : ""}`);
  },

  getUnreadCount: () =>
    api.get<{ count: number }>("/api/notifications/unread-count"),

  markAsRead: (id: number) =>
    api.patch<Notification>(`/api/notifications/${id}/read`),

  markAllAsRead: async () => {
    try {
      return await api.patch<{ count: number }>("/api/notifications/read-all");
    } catch {
      // Fallback: fetch unread notifications and mark them read individually
      const unreadList = await api.get<Notification[]>("/api/notifications?isRead=false&limit=50");
      if (Array.isArray(unreadList)) {
        await Promise.all(unreadList.map((n) => api.patch(`/api/notifications/${n.id}/read`)));
      }
      return { count: unreadList?.length || 0 };
    }
  },
};
