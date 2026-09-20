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
import { formatRelativeTime, formatNotificationMessage, formatNotificationTitle, resolveNotificationLink } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import {
  Bell,
  CheckCheck,
  Calendar,
  Briefcase,
  ShieldCheck,
  Check,
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
    queryKey: ["notifications", { filterUnread, page }],
    queryFn: () =>
      notificationApi.getNotifications({
        isRead: filterUnread ? false : undefined,
        page,
        limit: pageSize,
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

  const notifications = notificationsQuery.data?.items || [];
  const totalItems = notificationsQuery.data?.total || 0;
  const unreadCount = notificationsQuery.data?.unreadCount || 0;
  const totalPages = Math.max(1, notificationsQuery.data?.totalPages || 1);

  const getHeaderConfig = () => {
    if (user?.role === Role.TALENT_ACQUISITION) {
      return {
        title: "Notifications",
         description: "Stay informed about applications, interview reminders, and important updates.",
        breadcrumbs: [
          { label: "Talent acquisition", href: "/ta" },
          { label: "Notifications" },
        ],
      };
    }
    if (user?.role === Role.ADMINISTRATOR) {
      return {
        title: "Notifications",
         description: "Stay informed about access, matching, hiring requests, and important updates.",
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
        return <Calendar className="w-4 h-4 text-[#5B3FD6]" />;
      case "APPLICATION_STATUS":
        return <Briefcase className="w-4 h-4 text-[#0B315D]" />;
      case "COMPLIANCE_REQUIRED":
        return <ShieldCheck className="w-4 h-4 text-[#B45309]" />;
      default:
        return <Bell className="w-4 h-4 text-[#627D98]" />;
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
      <div className="flex items-center gap-2 border-b border-[#D9E2EC] pb-3">
        <button
          type="button"
          aria-pressed={!filterUnread}
          onClick={() => {
            setFilterUnread(false);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] md:min-h-0 ${
            !filterUnread
              ? "bg-[#0B315D] text-white shadow-xs"
              : "text-[#627D98] hover:text-[#102A43] hover:bg-[#EAF0F7]"
          }`}
        >
          {notificationsQuery.isLoading
            ? "All notifications"
            : !filterUnread
            ? `All notifications (${totalItems})`
            : "All notifications"}
        </button>
        <button
          type="button"
          aria-pressed={filterUnread}
          onClick={() => {
            setFilterUnread(true);
            setPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px] md:min-h-0 ${
            filterUnread
              ? "bg-[#0B315D] text-white shadow-xs"
              : "text-[#627D98] hover:text-[#102A43] hover:bg-[#EAF0F7]"
          }`}
        >
          {notificationsQuery.isLoading ? "Unread Only" : `Unread Only (${unreadCount})`}
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
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-xs">
          <EmptyState
            icon={<Bell className="w-6 h-6 text-[#627D98]" />}
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
          <div className="bg-white rounded-xl border border-[#D9E2EC] shadow-xs divide-y divide-[#D9E2EC] overflow-hidden">
             {notifications.map((n) => {
               const notificationLink = resolveNotificationLink(n.link, user?.role);
               return (
                   <div
                     key={n.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 transition-colors ${
                  !n.isRead ? "bg-[#EAF0F7]/50" : "hover:bg-[#F7F9FC]"
                }`}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-[#F7F9FC] border border-[#D9E2EC] shrink-0 mt-0.5">
                    {getIconForType(n.type)}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#102A43]">{formatNotificationTitle(n.title, user?.role)}</span>
                       {!n.isRead && (
                         <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0B315D]">
                           <span className="w-2 h-2 rounded-full bg-[#0B315D] shrink-0" aria-hidden="true" />
                           <span className="sr-only">Unread</span>
                         </span>
                       )}
                    </div>
                    <p className="text-xs text-[#627D98] leading-relaxed max-w-2xl">
                      {formatNotificationMessage(n.message, user?.role)}
                    </p>
                  <div className="text-xs text-[#627D98]">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 pl-11 sm:pl-0">
                   {notificationLink && (
                       <Button
                      variant="outline"
                      size="sm"
                      rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.isRead) markReadMutation.mutate(n.id);
                        if (notificationLink.includes("?")) {
                          const [path, qs] = notificationLink.split("?");
                          const searchParams = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
                          navigate({ to: path as any, search: searchParams as any });
                        } else {
                          navigate({ to: notificationLink as any });
                        }
                      }}
                       title="View linked record"
                       className="text-[#102A43] text-sm"
                    >
                       View details
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
                      className="text-[#0B315D] hover:text-[#082747] hover:bg-[#EAF0F7] shrink-0"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
             );
             })}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-[#D9E2EC] p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
