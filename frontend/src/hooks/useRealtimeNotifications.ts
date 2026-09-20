import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { notificationApi } from "../lib/api/notification.api";
import { resolveApiBase } from "../lib/api/client";
import { resolveNotificationLink } from "../lib/utils";
import { useAuth } from "./useAuth";

export interface RealtimeToast {
  id: number;
  title: string;
  message: string;
  createdAt: string;
  link?: string | null;
  type?: string;
}

export function useRealtimeNotifications() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeToasts, setActiveToasts] = useState<RealtimeToast[]>([]);

  // 1. Unread count query
  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await notificationApi.getUnreadCount();
      return res.count;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000, // Background polling fallback
  });

  // 2. Recent notifications query
  const recentNotificationsQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: () => notificationApi.getNotifications({ limit: 10 }),
    enabled: isAuthenticated,
  });

  // 3. Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 4. SSE real-time stream connection
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

    fetchEventSource(`${API_BASE}/api/notifications/stream`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      onmessage(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "CONNECTED" || !data.id) return;

          // Invalidate notification counts and scope invalidation to the user's role
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          if (user.role === "ADMINISTRATOR") {
            queryClient.invalidateQueries({ queryKey: ["admin"] });
          } else if (user.role === "TALENT_ACQUISITION") {
            queryClient.invalidateQueries({ queryKey: ["ta"] });
          } else if (user.role === "APPLICANT") {
            queryClient.invalidateQueries({ queryKey: ["applicant"] });
          }

          // Trigger live toast notification
          const newToast: RealtimeToast = {
            id: data.id,
            title: data.title || "New Notification",
            message: data.message || "",
            createdAt: data.createdAt || new Date().toISOString(),
            link: data.link ?? null,
            type: data.type,
          };

          setActiveToasts((prev) => [newToast, ...prev.slice(0, 2)]);

          // Auto-dismiss toast after 6 seconds
          setTimeout(() => {
            setActiveToasts((prev) => prev.filter((t) => t.id !== newToast.id));
          }, 6000);
        } catch {
          // Ignore parse errors (e.g. heartbeat)
        }
      },
      onerror(err) {
        // SSE disconnected, fallback to polling
        console.warn("SSE stream disconnected, polling fallback active.", err);
      },
    }).catch(() => {
      // Abort or network stream termination handled gracefully
    });

    return () => {
      controller.abort();
    };
  }, [isAuthenticated, user, queryClient]);

  const dismissToast = (id: number) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToastClick = (toast: RealtimeToast) => {
    dismissToast(toast.id);
    markAsReadMutation.mutate(toast.id);
    const notificationLink = resolveNotificationLink(toast.link, user?.role);
    if (notificationLink) {
      if (notificationLink.includes("?")) {
        const [path, qs] = notificationLink.split("?");
        const searchParams = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
        navigate({ to: path as any, search: searchParams as any });
      } else {
        navigate({ to: notificationLink as any });
      }
    }
  };

  return {
    unreadCount: unreadCountQuery.data || 0,
    notifications: recentNotificationsQuery.data?.items || (Array.isArray(recentNotificationsQuery.data) ? recentNotificationsQuery.data : []),
    markAsRead: (id: number) => markAsReadMutation.mutate(id),
    activeToasts,
    dismissToast,
    handleToastClick,
  };
}
