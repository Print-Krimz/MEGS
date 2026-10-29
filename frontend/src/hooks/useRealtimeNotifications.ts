import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { connectNotificationStream } from "../lib/notification-stream";
import { notificationApi } from "../lib/api/notification.api";
import { resolveApiBase } from "../lib/api/client";
import { resolveNotificationLink } from "../lib/utils";
import { getNotificationInvalidationKeys, getRoleRoot } from "../lib/notification-invalidation";
import { NOTIFICATION_COUNT_POLL_MS, pollInterval } from "../lib/query-policies";
import { setLiveStreamConnected, useLiveStreamConnected } from "../lib/live-stream-status";
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
  const role = user?.role;
  const userId = user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeToasts, setActiveToasts] = useState<RealtimeToast[]>([]);
  const toastTimeouts = useRef(new Map<number, number>());
  const streamConnected = useLiveStreamConnected();

  useEffect(() => () => {
    toastTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    toastTimeouts.current.clear();
  }, []);

  // 1. Unread count query
  const unreadCountQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async ({ signal }) => {
      const res = await notificationApi.getUnreadCount({ signal });
      return res.count;
    },
    enabled: isAuthenticated,
    refetchInterval: pollInterval(NOTIFICATION_COUNT_POLL_MS, streamConnected), // Process-local SSE needs cross-process reconciliation.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // 2. Recent notifications query
  const recentNotificationsQuery = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: ({ signal }) => notificationApi.getNotifications({ limit: 10 }, { signal }),
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
    if (!isAuthenticated || !userId || !role) return;

    const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

    return connectNotificationStream({
      url: `${API_BASE}/api/notifications/stream`,
      getToken: () => localStorage.getItem("access_token"),
      onStatus: setLiveStreamConnected,
      // Anything sent while the stream was down is gone, so refresh what this role shows.
      onReconnect() {
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
        void queryClient.invalidateQueries({ queryKey: [getRoleRoot(role)] });
      },
      subscribeSession(restart) {
        // AuthProvider reloads the identity for cross-tab replacements; its user
        // update recreates this effect. Immediately stop a removed session here.
        const onStorage = (event: StorageEvent) => {
          if ((!event.key || event.key === "access_token") && !event.newValue) restart();
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener("auth-token-changed", restart);
        return () => {
          window.removeEventListener("storage", onStorage);
          window.removeEventListener("auth-token-changed", restart);
        };
      },
      onMessage(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "CONNECTED" || !data.id) return;

          // The stream is process-local, so polling remains the cross-instance fallback.
          // Only a recognized link identifies a cache slice; unknown events keep the role-wide fallback.
          const invalidationKeys = getNotificationInvalidationKeys(data, role);
          void Promise.all(
            invalidationKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
          );

          // Trigger live toast notification
          const newToast: RealtimeToast = {
            id: data.id,
            title: data.title || "New Notification",
            message: data.message || "",
            createdAt: data.createdAt || new Date().toISOString(),
            link: data.link ?? null,
            type: data.type,
          };

          setActiveToasts((prev) => [newToast, ...prev.filter((t) => t.id !== newToast.id).slice(0, 2)]);

          // Auto-dismiss toast after 6 seconds
          const priorTimeout = toastTimeouts.current.get(newToast.id);
          if (priorTimeout !== undefined) window.clearTimeout(priorTimeout);
          const timeoutId = window.setTimeout(() => {
            toastTimeouts.current.delete(newToast.id);
            setActiveToasts((prev) => prev.filter((t) => t.id !== newToast.id));
          }, 6000);
          toastTimeouts.current.set(newToast.id, timeoutId);
        } catch {
          // Ignore parse errors (e.g. heartbeat)
        }
      },
    });
  }, [isAuthenticated, userId, role, queryClient]);

  const dismissToast = (id: number) => {
    const timeoutId = toastTimeouts.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      toastTimeouts.current.delete(id);
    }
    setActiveToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleToastClick = (toast: RealtimeToast) => {
    dismissToast(toast.id);
    // Only mark read when still unread: skip if the cached list already shows it read.
    const cached = queryClient.getQueryData<unknown>(["notifications", "recent"]);
    const items = (Array.isArray(cached) ? cached : (cached as { items?: unknown[] } | undefined)?.items) as
      | Array<{ id: number; isRead?: boolean }>
      | undefined;
    const alreadyRead = items?.some((n) => n.id === toast.id && n.isRead === true) ?? false;
    if (!alreadyRead) markAsReadMutation.mutate(toast.id);
    const notificationLink = resolveNotificationLink(toast.link, role);
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
