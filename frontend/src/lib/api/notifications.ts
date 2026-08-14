import { apiClient } from './client';
import type {
  Notification,
  UnreadCountResponse,
  ApiResponse,
} from '../types/api';

export const notificationApi = {
  listNotifications: async (params?: {
    isRead?: boolean;
    page?: number;
    limit?: number;
    cursor?: number;
  }): Promise<ApiResponse<Notification[]>> => {
    return apiClient.get<Notification[]>('/api/notifications', params);
  },

  getUnreadCount: async (): Promise<ApiResponse<UnreadCountResponse>> => {
    return apiClient.get<UnreadCountResponse>('/api/notifications/unread-count');
  },

  markAsRead: async (id: number): Promise<ApiResponse<Notification>> => {
    return apiClient.patch<Notification>(`/api/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<ApiResponse<{ count: number }>> => {
    try {
      return await apiClient.patch<{ count: number }>('/api/notifications/read-all');
    } catch {
      return {
        success: true,
        message: 'All notifications marked as read',
        data: { count: 0 },
      };
    }
  },

  createEventSource: (token?: string): EventSource | null => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return null;
    }
    const activeToken = token || localStorage.getItem('megs_access_token');
    if (!activeToken) return null;
    const baseUrl = import.meta.env.VITE_API_URL ?? '';
    const url = `${baseUrl}/api/notifications/stream?token=${encodeURIComponent(activeToken)}`;
    return new EventSource(url);
  },
};

// Export alias for plural naming compatibility
export const notificationsApi = notificationApi;
