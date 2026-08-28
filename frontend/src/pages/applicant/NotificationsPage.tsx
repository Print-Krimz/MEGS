import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "../../lib/api/notification.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatRelativeTime, formatNotificationMessage } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import {
  Bell,
  CheckCheck,
  Calendar,
  Briefcase,
  ShieldCheck,
  Check,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const notificationsQuery = useQuery({
    queryKey: ["notifications", { filterUnread }],
    queryFn: () =>
      notificationApi.getNotifications({
        isRead: filterUnread ? false : undefined,
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize));
  const paginatedNotifications = notifications.slice((page - 1) * pageSize, page * pageSize);

  const getHeaderConfig = () => {
    if (user?.role === Role.TALENT_ACQUISITION) {
      return {
        title: "Notifications",
        description: "Stay informed about applications, interview targets (SLA), and important updates.",
        breadcrumbs: [
          { label: "Talent acquisition", href: "/ta" },
          { label: "Notifications" },
        ],
      };
    }
    if (user?.role === Role.ADMINISTRATOR) {
      return {
        title: "Notifications",
        description: "Stay informed about access, score reviews, and important updates.",
        breadcrumbs: [
          { label: "Administration", href: "/admin" },
          { label: "Notifications" },
        ],
      };
    }
    return {
      title: "Notifications",
      description: "Stay informed about interviews, application updates, and employment documents.",
      breadcrumbs: [
        { label: "My career", href: "/app" },
        { label: "Notifications" },
      ],
    };
  };

  const headerConfig = getHeaderConfig();

  const getIconForType = (type?: string) => {
    switch (type) {
      case "INTERVIEW_SCHEDULED":
      case "INTERVIEW_SLA":
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case "APPLICATION_STATUS":
        return <Briefcase className="w-4 h-4 text-teal-600" />;
      case "COMPLIANCE_REQUIRED":
        return <ShieldCheck className="w-4 h-4 text-amber-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={headerConfig.title}
        description={headerConfig.description}
        breadcrumbs={headerConfig.breadcrumbs}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
              loading={markAllReadMutation.isPending}
              disabled={unreadCount === 0}
              onClick={() => markAllReadMutation.mutate()}
            >
              Mark All as Read
            </Button>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => {
            setFilterUnread(false);
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            !filterUnread
              ? "bg-teal-50 text-teal-800 border border-teal-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          All Notifications ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setFilterUnread(true);
            setPage(1);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filterUnread
              ? "bg-teal-50 text-teal-800 border border-teal-200"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* List Container */}
      {notificationsQuery.isLoading ? (
        <LoadingState variant="table" rows={4} />
      ) : notificationsQuery.isError ? (
        <ErrorState
          error={notificationsQuery.error}
          onRetry={() => notificationsQuery.refetch()}
        />
      ) : notifications.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
          <EmptyState
            icon={<Bell className="w-6 h-6" />}
            title="No notifications to show"
            description={
              filterUnread
                ? "You have read all received notices."
                : "You have no notifications in your inbox."
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {paginatedNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.isRead) markReadMutation.mutate(n.id);
                  if (n.link) navigate({ to: n.link as any });
                }}
                className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                  !n.isRead ? "bg-teal-50/20" : "hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                    {getIconForType(n.type)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{n.title}</span>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                      )}
                      {n.link && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                          <span>View Record</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      {formatNotificationMessage(n.message, user?.role)}
                    </p>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {n.link && (
                    <Button
                      variant="outline"
                      size="sm"
                      rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.isRead) markReadMutation.mutate(n.id);
                        navigate({ to: n.link as any });
                      }}
                      title="Open linked record"
                      className="text-slate-700 text-xs hidden sm:flex"
                    >
                      Open
                    </Button>
                  )}
                  {!n.isRead && (
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Check className="w-3.5 h-3.5" />}
                      loading={markReadMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(n.id);
                      }}
                      title="Mark as read"
                      className="text-teal-700 hover:text-teal-900 shrink-0"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-slate-300 p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={notifications.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
