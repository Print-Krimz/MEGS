import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Loader2,
  BellOff,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '../../lib/api/notifications';
import { useAuth } from '../../hooks/useAuth';
import { useNotificationStream } from '../../hooks/useNotificationStream';
import { cn } from '../../lib/utils';
import type { Notification, ApiResponse, UnreadCountResponse } from '../../lib/types/api';

// Format relative time helper
export function formatRelativeTime(dateString?: string | Date | null): string {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return String(dateString);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 45) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

// Icon component based on Notification type
function NotificationTypeIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'SUCCESS':
      return (
        <div
          data-testid="icon-success"
          className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" />
        </div>
      );
    case 'WARNING':
      return (
        <div
          data-testid="icon-warning"
          className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"
        >
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    case 'ERROR':
      return (
        <div
          data-testid="icon-error"
          className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0"
        >
          <AlertCircle className="w-4 h-4" />
        </div>
      );
    case 'INFO':
    default:
      return (
        <div
          data-testid="icon-info"
          className="w-8 h-8 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0"
        >
          <Info className="w-4 h-4" />
        </div>
      );
  }
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Connect SSE real-time stream
  useNotificationStream({ enabled: isAuthenticated });

  // Query: Unread count
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Query: Notifications list
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.listNotifications({ limit: 15 }),
    enabled: isAuthenticated && isOpen,
  });

  // Mutation: Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onMutate: async (id: number) => {
      // Optimistically update query cache
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(
        ['notifications', 'unread-count'],
        (old) => {
          const current = old?.data?.unreadCount ?? old?.data?.count ?? 0;
          const nextCount = Math.max(0, current - 1);
          return {
            success: true,
            message: 'Updated',
            data: { unreadCount: nextCount, count: nextCount },
          };
        }
      );

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.map((item: Notification) =>
            item.id === id ? { ...item, isRead: true } : item
          ),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mutation: Mark all notifications as read
  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onMutate: async () => {
      // Optimistically clear unread count & mark all cached as read
      await queryClient.cancelQueries({ queryKey: ['notifications'] });

      queryClient.setQueryData<ApiResponse<UnreadCountResponse>>(
        ['notifications', 'unread-count'],
        {
          success: true,
          message: 'Updated',
          data: { unreadCount: 0, count: 0 },
        }
      );

      queryClient.setQueriesData({ queryKey: ['notifications', 'list'] }, (old: any) => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.map((item: Notification) => ({ ...item, isRead: true })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unreadCount = unreadData?.data?.unreadCount ?? unreadData?.data?.count ?? 0;
  const notifications = notificationsData?.data ?? [];

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (n: Notification) => {
    if (!n.isRead) {
      markReadMutation.mutate(n.id);
    }
    setIsOpen(false);
    if (n.link) {
      navigate(n.link);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        data-testid="notification-bell-btn"
        className={cn(
          'relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition duration-150 focus:outline-none focus:ring-2 focus:ring-primary/20',
          isOpen && 'bg-slate-100 text-slate-800'
        )}
      >
        <Bell className="w-5 h-5 stroke-[1.75]" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold font-mono text-white bg-rose-500 rounded-full border-2 border-white animate-pulse shadow-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl shadow-lg border border-border bg-card overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 border-b border-border flex items-center justify-between bg-slate-50/80">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900">Notifications</h4>
              {unreadCount > 0 && (
                <span
                  data-testid="unread-count-header"
                  className="px-2 py-0.5 text-xs font-semibold font-mono bg-teal-50 text-teal-700 border border-teal-200/60 rounded-full"
                >
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                data-testid="mark-all-read-btn"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 hover:underline disabled:opacity-50 transition duration-150"
              >
                {markAllReadMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                <span>Mark all as read</span>
              </button>
            )}
          </div>

          {/* Body: Notifications List / Skeleton / Empty State */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
            {isLoading ? (
              <div data-testid="notification-loading-skeleton" className="p-4 space-y-4">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div
                data-testid="notification-empty-state"
                className="py-10 px-6 text-center flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <BellOff className="w-5 h-5 stroke-[1.5]" />
                </div>
                <div className="text-xs font-semibold text-foreground">No notifications yet</div>
                <div className="text-xs text-muted-foreground">You're all caught up</div>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  data-testid={`notification-item-${n.id}`}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'p-4 hover:bg-slate-50 transition border-b border-border/60 last:border-0 flex items-start gap-3 cursor-pointer group',
                    !n.isRead && 'bg-teal-50/40 hover:bg-teal-50/60'
                  )}
                >
                  <NotificationTypeIcon type={n.type} />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          !n.isRead ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                        )}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span
                          data-testid="unread-dot"
                          title="Unread"
                          className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0 mt-1"
                        />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs text-slate-400 font-medium mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </span>

                      {n.link && (
                        <span className="text-xs text-primary group-hover:underline font-medium inline-flex items-center gap-0.5 mt-1">
                          View details <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {!n.isRead && (
                    <button
                      type="button"
                      data-testid={`mark-read-btn-${n.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(n.id);
                      }}
                      title="Mark as read"
                      className="text-slate-400 hover:text-teal-700 p-1.5 rounded-lg hover:bg-teal-100/50 transition duration-150 flex-shrink-0"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
