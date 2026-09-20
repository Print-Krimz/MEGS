import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ExternalLink, ArrowUpRight } from "lucide-react";
import { formatRelativeTime, formatNotificationMessage, formatNotificationTitle, resolveNotificationLink } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import type { Notification } from "../../lib/types/notification.types";
import { notificationApi } from "../../lib/api/notification.api";

export interface NotificationBellProps {
  notifications?: Notification[];
  unreadCount?: number;
  onMarkAsRead?: (id: number) => void;
  viewAllLink?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  viewAllLink,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownId = "notifications-menu";

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const resolvedViewAllLink =
    viewAllLink ??
    (user?.role === Role.TALENT_ACQUISITION
      ? "/ta/notifications"
      : user?.role === Role.ADMINISTRATOR
      ? "/admin/notifications"
      : "/app/notifications");

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open]);

  const handleItemClick = (n: Notification) => {
    setOpen(false);
    if (!n.isRead && onMarkAsRead) {
      onMarkAsRead(n.id);
    }
    const notificationLink = resolveNotificationLink(n.link, user?.role);
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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="relative min-h-11 min-w-11 inline-flex items-center justify-center rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? dropdownId : undefined}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-[14px] items-center justify-center bg-rose-600 px-1 text-[9px] font-mono font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div id={dropdownId} className="absolute right-0 mt-1 w-[min(24rem,calc(100vw-1.5rem))] bg-white shadow-modal border border-slate-300 z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-slate-900 truncate">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-teal-100 text-teal-900 border border-teal-300 text-xs font-medium shrink-0">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={unreadCount === 0 || markAllReadMutation.isPending}
                className="text-xs font-medium text-teal-700 hover:text-teal-900 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1 px-1.5 py-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 cursor-pointer"
                aria-label="Mark all notifications as read"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
              <Link
                to={resolvedViewAllLink}
                onClick={() => setOpen(false)}
                className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1 px-1.5 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              >
                <span>View all</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* List */}
          <ul aria-label="Recent notifications" className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <li className="p-6 text-center text-sm text-slate-500">
                No recent notifications
              </li>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start justify-between gap-2 p-1.5 ${!n.isRead ? "bg-teal-50/30" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className="min-h-11 flex-1 p-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-slate-900 truncate">
                         {formatNotificationTitle(n.title, user?.role)}
                      </span>
                      {n.link && <ArrowUpRight className="w-3 h-3 text-teal-600 shrink-0" />}
                    </div>
                    <div className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                      {formatNotificationMessage(n.message, user?.role)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </button>

                  {!n.isRead && onMarkAsRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(n.id);
                      }}
                      className="min-h-11 min-w-11 p-2 text-teal-700 hover:text-teal-900 rounded-md hover:bg-teal-100/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
                      aria-label={`Mark ${n.title} as read`}
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
