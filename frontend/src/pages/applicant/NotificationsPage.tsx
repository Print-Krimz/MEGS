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
  Tabs,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatRelativeTime, formatNotificationMessage, formatNotificationTitle, resolveNotificationLink, cn } from "../../lib/utils";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import type { Notification as NotificationItem } from "../../lib/types/notification.types";
import {
  Bell,
  CheckCheck,
  Calendar,
  Briefcase,
  ShieldCheck,
  Check,
  ExternalLink,
} from "lucide-react";


/**
 * Shared by applicants, TA and admin. Staff (TA, admin) get the square slate panels used across the
 * staff portals; applicants keep their own softer look.
 */
export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const staff = user?.role === Role.TALENT_ACQUISITION || user?.role === Role.ADMINISTRATOR;

  const notificationsQuery = useQuery({
    queryKey: ["notifications", { filterUnread, page }],
    queryFn: () =>
      notificationApi.getNotifications({
        isRead: filterUnread ? false : undefined,
        page,
        limit: pageSize,
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
  };

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markAsRead,
    onSuccess: invalidate,
    onError: (error) => notify.error("Could not mark the notification as read", error),
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllAsRead,
    onSuccess: invalidate,
    onError: (error) => notify.error("Could not mark all notifications as read", error),
  });

  const notifications = notificationsQuery.data?.items || [];
  const totalItems = notificationsQuery.data?.total || 0;
  const unreadCount = notificationsQuery.data?.unreadCount || 0;
  const totalPages = Math.max(1, notificationsQuery.data?.totalPages || 1);
  // Only the row being marked shows a pending state.
  const pendingId = markReadMutation.isPending ? markReadMutation.variables : undefined;

  const getHeaderConfig = () => {
    if (user?.role === Role.TALENT_ACQUISITION) {
      return {
        title: "Notifications",
        description: "Stay informed about applications, interview reminders, and important updates.",
        breadcrumbs: [
          { label: TA_COPY.breadcrumbRoot, href: "/ta" },
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
    const color = (applicant: string) => (staff ? "text-navy" : applicant);
    switch (type) {
      case "INTERVIEW_SCHEDULED":
      case "INTERVIEW_SLA":
        return <Calendar className={cn("w-4 h-4", color("text-[#5B3FD6]"))} />;
      case "APPLICATION_STATUS":
        return <Briefcase className={cn("w-4 h-4", color("text-[#0B315D]"))} />;
      case "COMPLIANCE_REQUIRED":
        return <ShieldCheck className={cn("w-4 h-4", staff ? "text-amber-700" : "text-[#B45309]")} />;
      default:
        return <Bell className={cn("w-4 h-4", staff ? "text-slate-500" : "text-[#627D98]")} />;
    }
  };

  const openRecord = (n: NotificationItem, link: string) => {
    if (!n.isRead) markReadMutation.mutate(n.id);
    if (link.includes("?")) {
      const [path, qs] = link.split("?");
      const searchParams = qs ? Object.fromEntries(new URLSearchParams(qs)) : undefined;
      navigate({ to: path as any, search: searchParams as any });
    } else {
      navigate({ to: link as any });
    }
  };

  const changeFilter = (unreadOnly: boolean) => {
    setFilterUnread(unreadOnly);
    setPage(1);
  };

  const pagination = (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={pageSize}
      onPageChange={setPage}
      variant={staff ? "inset" : "default"}
      itemLabel={staff ? "notifications" : undefined}
    />
  );

  const markAllButton = (
    <Button
      variant="outline"
      size="sm"
      leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
      loading={markAllReadMutation.isPending}
      disabled={unreadCount === 0}
      title={unreadCount === 0 ? "Everything is already read" : undefined}
      onClick={() => markAllReadMutation.mutate()}
    >
      {staff ? "Mark all as read" : "Mark All as Read"}
    </Button>
  );

  if (staff) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={headerConfig.title}
          breadcrumbs={headerConfig.breadcrumbs}
          actions={unreadCount > 0 ? markAllButton : undefined}
          flush
        />

        <div className="border border-slate-300 bg-white">
          <Tabs
            ariaLabel="Notification filter"
            value={filterUnread ? "unread" : "all"}
            onChange={(id) => changeFilter(id === "unread")}
            items={[
              { id: "all", label: "All notifications" },
              {
                id: "unread",
                label: "Unread",
                badge: notificationsQuery.isLoading ? undefined : { text: String(unreadCount), variant: "info" },
              },
            ]}
          />

          {notificationsQuery.isLoading ? (
            <LoadingState variant="table" rows={4} />
          ) : notificationsQuery.isError ? (
            <ErrorState className="my-0 border-0" error={notificationsQuery.error} onRetry={() => notificationsQuery.refetch()} />
          ) : notifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                bare
                icon={<Bell className="w-6 h-6" />}
                title={filterUnread ? "No unread notifications" : "No notifications yet"}
                description={filterUnread ? "You have read everything." : "Updates about your work will show up here."}
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-slate-200">
                {notifications.map((n) => {
                  const link = resolveNotificationLink(n.link, user?.role);
                  const title = formatNotificationTitle(n.title, user?.role);
                  return (
                    <li
                      key={n.id}
                      className={cn("flex items-start gap-3 p-4", !n.isRead ? "bg-navy-soft/60" : "hover:bg-slate-50")}
                    >
                      <div className="mt-0.5 shrink-0 border border-slate-300 bg-slate-100 p-2">{getIconForType(n.type)}</div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {link ? (
                            <button
                              type="button"
                              onClick={() => openRecord(n, link)}
                              className="focus-ring inline-flex min-h-11 items-center gap-1.5 text-left text-sm font-semibold text-slate-950 underline-offset-2 hover:underline md:min-h-0"
                            >
                              {title}
                              <ExternalLink className="h-3 w-3 shrink-0 text-slate-500" aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="text-sm font-semibold text-slate-950">{title}</span>
                          )}
                          {!n.isRead && (
                            <span className="inline-flex items-center">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-navy" aria-hidden="true" />
                              <span className="sr-only">Unread</span>
                            </span>
                          )}
                        </div>
                        <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                          {formatNotificationMessage(n.message, user?.role)}
                        </p>
                        <div className="text-xs text-slate-600">{formatRelativeTime(n.createdAt)}</div>
                      </div>
                      {!n.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={pendingId === n.id}
                          onClick={() => markReadMutation.mutate(n.id)}
                          title="Mark as read"
                          aria-label={`Mark "${title}" as read`}
                          className="size-11 shrink-0 p-0 text-navy md:size-9"
                        >
                          {pendingId === n.id ? null : <Check className="h-4 w-4" aria-hidden="true" />}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-slate-200">{pagination}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={headerConfig.title}
        description={headerConfig.description}
        breadcrumbs={headerConfig.breadcrumbs}
        actions={<div className="flex gap-2">{markAllButton}</div>}
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#D9E2EC] pb-3">
        <button
          type="button"
          aria-pressed={!filterUnread}
          onClick={() => changeFilter(false)}
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
          onClick={() => changeFilter(true)}
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
                      <div className="text-xs text-[#627D98]">{formatRelativeTime(n.createdAt)}</div>
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
                          openRecord(n, notificationLink);
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
                        loading={pendingId === n.id}
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
          <div className="bg-white border border-[#D9E2EC] p-2">{pagination}</div>
        </div>
      )}
    </div>
  );
};
