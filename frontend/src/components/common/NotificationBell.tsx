import React, { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { formatRelativeTime } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import type { Notification } from "../../lib/types/notification.types";

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
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-700"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-[14px] items-center justify-center bg-rose-600 px-1 text-[9px] font-mono font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 sm:w-96 bg-white shadow-modal border border-slate-400 z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 border border-teal-300 text-[10px] font-mono font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <Link
              to={resolvedViewAllLink}
              onClick={() => setOpen(false)}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1"
            >
              <span>View all</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No recent notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 text-left transition-colors flex items-start justify-between gap-2 hover:bg-slate-50 ${
                    !n.isRead ? "bg-teal-50/30" : ""
                  }`}
                >
                  <div className="space-y-1 overflow-hidden">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {n.title}
                    </div>
                    <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {n.message}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>

                  {!n.isRead && onMarkAsRead && (
                    <button
                      type="button"
                      onClick={() => onMarkAsRead(n.id)}
                      className="p-1 text-teal-600 hover:text-teal-800 rounded-md hover:bg-teal-100/50 transition-colors shrink-0"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
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
};
