import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationApi } from '../lib/api/notifications';
import type { Notification, ApiResponse, UnreadCountResponse } from '../lib/types/api';

interface UseNotificationStreamOptions {
  enabled?: boolean;
}

export function useNotificationStream({ enabled = true }: UseNotificationStreamOptions = {}) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(1000);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    const connectSSE = () => {
      if (!isMountedRef.current) return;

      // Close previous connection if active
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      try {
        const es = notificationApi.createEventSource();
        if (!es) return;

        eventSourceRef.current = es;

        es.onopen = () => {
          // Reset backoff on successful connection
          backoffRef.current = 1000;
        };

        es.onmessage = (event: MessageEvent) => {
          if (!event.data) return;

          try {
            const raw = JSON.parse(event.data);

            // Ignore system/connection handshake & keep-alive messages
            if (raw.type === 'CONNECTED' || raw.type === 'KEEP_ALIVE' || raw === 'keep-alive') {
              backoffRef.current = 1000;
              return;
            }

            // Notification payload
            const notification: Notification = raw;

            // Trigger floating toast
            const toastTitle = notification.title || 'New Notification';
            const toastOptions = { description: notification.message || undefined };

            switch (notification.type) {
              case 'SUCCESS':
                toast.success(toastTitle, toastOptions);
                break;
              case 'WARNING':
                toast.warning(toastTitle, toastOptions);
                break;
              case 'ERROR':
                toast.error(toastTitle, toastOptions);
                break;
              case 'INFO':
              default:
                toast.info(toastTitle, toastOptions);
                break;
            }

            // Update unread count in TanStack Query cache
            queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(
              ['notifications', 'unread-count'],
              (old) => {
                const current = old?.data?.unreadCount ?? old?.data?.count ?? 0;
                return {
                  success: true,
                  message: 'Unread count updated',
                  data: {
                    unreadCount: current + 1,
                    count: current + 1,
                  },
                };
              }
            );

            // Prepend new notification to cached notifications lists
            queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
              if (!old?.data || !Array.isArray(old.data)) return old;
              const exists = old.data.some((item: Notification) => item.id === notification.id);
              if (exists) return old;
              return {
                ...old,
                data: [notification, ...old.data],
              };
            });

            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: any) => {
              if (old?.data && Array.isArray(old.data)) {
                const exists = old.data.some((item: Notification) => item.id === notification.id);
                if (exists) return old;
                return {
                  ...old,
                  data: [notification, ...old.data],
                };
              }
              return old;
            });

            // Invalidate queries in background
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          } catch {
            // Non-JSON or malformed message
          }
        };

        es.onerror = () => {
          if (es.readyState === 2 || es.readyState === 0) { // CLOSED or CONNECTING error
            es.close();
            eventSourceRef.current = null;

            // Exponential backoff reconnect
            const delay = backoffRef.current;
            backoffRef.current = Math.min(delay * 2, 30000);

            if (isMountedRef.current) {
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
              }
              reconnectTimeoutRef.current = setTimeout(() => {
                connectSSE();
              }, delay);
            }
          }
        };
      } catch {
        // Handle EventSource instantiation error
      }
    };

    connectSSE();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, queryClient]);

  return {
    eventSource: eventSourceRef.current,
  };
}
