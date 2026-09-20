import { api } from "./client";
import type { Notification, PaginatedNotifications } from "../types/notification.types";

export interface NotificationQueryParams {
  isRead?: boolean;
  page?: number;
  limit?: number;
}

export const notificationApi = {
  getNotifications: async (params?: NotificationQueryParams): Promise<PaginatedNotifications> => {
    const searchParams = new URLSearchParams();
    if (params?.isRead !== undefined) searchParams.append("isRead", String(params.isRead));
    if (params?.page) searchParams.append("page", String(params.page));
    if (params?.limit) searchParams.append("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await api.get<any>(`/api/notifications${qs ? `?${qs}` : ""}`);
    // Normalize response if backend returns envelope or array
    if (res && Array.isArray(res.items)) {
      return {
        items: res.items,
        total: res.total ?? res.items.length,
        unreadCount: res.unreadCount ?? 0,
        page: res.page ?? params?.page ?? 1,
        pageSize: res.pageSize ?? params?.limit ?? res.items.length,
        totalPages: res.totalPages ?? Math.ceil((res.total ?? res.items.length) / (params?.limit ?? 10)),
      };
    }
    if (Array.isArray(res)) {
      return {
        items: res,
        total: res.length,
        unreadCount: res.filter((n: Notification) => !n.isRead).length,
        page: params?.page ?? 1,
        pageSize: params?.limit ?? res.length,
        totalPages: 1,
      };
    }
    return { items: [], total: 0, unreadCount: 0, page: 1, pageSize: 10, totalPages: 1 };
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
      const unreadList = await api.get<any>("/api/notifications?isRead=false&limit=50");
      const items: Notification[] = Array.isArray(unreadList) ? unreadList : (unreadList?.items ?? []);
      if (Array.isArray(items)) {
        await Promise.all(items.map((n) => api.patch(`/api/notifications/${n.id}/read`)));
      }
      return { count: items?.length || 0 };
    }
  },
};
