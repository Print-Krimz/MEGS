import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { adminApi, type AdminUserSummary } from "../../lib/api/admin.api";
import type { DatabaseBackupRecord } from "../../lib/types/admin.types";
import {
  PageHeader,
  EmptyState,
  OverviewSectionData,
  OverviewMetricValue,
  OverviewMetricTile,
  OverviewPanelHeader,
} from "../../components/common";
import { Button } from "../../components/ui";
import { cn, formatDate, formatDateTime, displayEmail } from "../../lib/utils";
import { resolveUserName } from "../../lib/user-name";
import { formatSampled } from "../../lib/analytics-format";
import { formatAdminBackupStatus, formatAdminRole } from "../../lib/admin-copy";
import { formatAction, formatTargetEntity } from "../../lib/utils/audit-formatter";

type SystemCheckTone = "danger" | "warning" | "neutral";

interface SystemCheckLink {
  key: string;
  label: string;
  detail: string;
  to: string;
  search?: Record<string, string>;
  tone: SystemCheckTone;
}

const TONE_ORDER: Record<SystemCheckTone, number> = {
  danger: 0,
  warning: 1,
  neutral: 2,
};

const CHECK_TONE_CLASSES: Record<SystemCheckTone, string> = {
  danger: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100/70",
  warning: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100/70",
  neutral: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
};

function buildUserSummaryChecks(users: AdminUserSummary): SystemCheckLink[] {
  const totalInvites = users.pendingInvitations + users.expiredInvitations;
  return [
    {
      key: "invitations",
      label: "Invitations",
      detail: `${totalInvites} (${users.pendingInvitations} pending, ${users.expiredInvitations} expired)`,
      to: "/admin/users",
      search: { status: "invited" },
      tone: users.expiredInvitations > 0 ? "danger" : "neutral",
    },
    {
      key: "inactive-accounts",
      label: "Inactive accounts",
      detail: String(users.inactiveAccounts),
      to: "/admin/users",
      search: { status: "inactive" },
      tone: "neutral",
    },
    {
      key: "failed-jobs",
      label: "Failed scoring jobs",
      detail: String(users.failedJobs),
      to: "/admin/scoring/quality",
      tone: users.failedJobs > 0 ? "danger" : "neutral",
    },
    {
      key: "applicant-requests",
      label: "Applicant requests",
      detail: `${users.pendingRequests} waiting`,
      to: "/admin/analytics",
      search: { tab: "waiting" },
      tone: users.pendingRequests > 0 ? "warning" : "neutral",
    },
  ];
}

function buildBackupCheck(backups: DatabaseBackupRecord[]): SystemCheckLink {
  const latest = backups[0];
  return {
    key: "latest-backup",
    label: "Latest backup",
    detail: latest
      ? `${formatDate(latest.createdAt)} · ${formatAdminBackupStatus(latest.status)}`
      : "No backups yet",
    to: "/admin/maintenance",
    tone: !latest || latest.status === "FAILED" ? "danger" : "neutral",
  };
}

interface SystemStatusStripProps {
  userSummaryQuery: UseQueryResult<AdminUserSummary>;
  backupsQuery: UseQueryResult<DatabaseBackupRecord[]>;
}

const SystemStatusStrip: React.FC<SystemStatusStripProps> = ({
  userSummaryQuery,
  backupsQuery,
}) => {
  const userLoading =
    userSummaryQuery.isPending || (userSummaryQuery.isError && userSummaryQuery.isFetching);
  const userError = userSummaryQuery.isError && !userSummaryQuery.isFetching;
  const backupsLoading =
    backupsQuery.isPending || (backupsQuery.isError && backupsQuery.isFetching);
  const backupsError = backupsQuery.isError && !backupsQuery.isFetching;

  const checks: SystemCheckLink[] = [
    ...(userSummaryQuery.data && !userLoading && !userError
      ? buildUserSummaryChecks(userSummaryQuery.data)
      : []),
    ...(backupsQuery.data && !backupsLoading && !backupsError
      ? [buildBackupCheck(backupsQuery.data)]
      : []),
  ].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

  const alertCount = checks.filter((item) => item.tone !== "neutral").length;
  const allLoaded =
    userSummaryQuery.data !== undefined &&
    backupsQuery.data !== undefined &&
    !userLoading &&
    !backupsLoading &&
    !userError &&
    !backupsError;

  return (
    <section
      aria-labelledby="admin-system-status"
      className="rounded-md border border-slate-300 bg-white px-3.5 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="admin-system-status"
          className="text-xs font-semibold uppercase tracking-wide text-slate-600"
        >
          System status
        </h2>
        {alertCount > 0 ? (
          <span className="text-xs font-medium text-rose-700 tabular-nums">
            {alertCount} {alertCount === 1 ? "item needs" : "items need"} attention
          </span>
        ) : allLoaded ? (
          <span className="text-xs text-slate-600">All checks normal</span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {checks.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            search={item.search as never}
            className={cn(
              "focus-ring inline-flex min-h-11 items-center gap-1.5 rounded border px-2.5 py-1 text-xs transition-colors tabular-nums md:min-h-8",
              CHECK_TONE_CLASSES[item.tone],
            )}
          >
            <span className="font-medium">{item.label}</span>
            <span className="font-semibold">{item.detail}</span>
          </Link>
        ))}

        {userLoading && (
          <span
            role="status"
            aria-label="Loading account and job checks"
            className="flex flex-wrap items-center gap-2 motion-safe:animate-pulse"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="inline-block h-7 w-32 rounded bg-slate-200" />
            ))}
            <span className="sr-only">Loading account and job checks</span>
          </span>
        )}

        {userError && (
          <span
            role="alert"
            className="inline-flex min-h-11 items-center gap-2 rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800 md:min-h-8"
          >
            <span>Could not load account and job checks.</span>
            <button
              type="button"
              onClick={() => {
                void userSummaryQuery.refetch();
              }}
              className="focus-ring min-h-11 px-1 font-medium text-rose-900 underline hover:text-rose-950 md:min-h-0"
            >
              Try again
            </button>
          </span>
        )}

        {backupsLoading && (
          <span
            role="status"
            aria-label="Loading backup status"
            className="inline-flex h-7 w-32 rounded bg-slate-200 motion-safe:animate-pulse"
          >
            <span className="sr-only">Loading backup status</span>
          </span>
        )}

        {backupsError && (
          <span
            role="alert"
            className="inline-flex min-h-11 items-center gap-2 rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs text-rose-800 md:min-h-8"
          >
            <span>Could not load latest backup.</span>
            <button
              type="button"
              onClick={() => {
                void backupsQuery.refetch();
              }}
              className="focus-ring min-h-11 px-1 font-medium text-rose-900 underline hover:text-rose-950 md:min-h-0"
            >
              Try again
            </button>
          </span>
        )}
      </div>
    </section>
  );
};

export const AdminDashboard: React.FC = () => {
  const userSummaryQuery = useQuery({
    queryKey: ["admin", "users", "summary"],
    queryFn: ({ signal }) => adminApi.getUserSummary({ signal }),
  });
  // Same key as the Reports page so the two share one cached response.
  const teamQuery = useQuery({
    queryKey: ["admin", "analytics", "dashboard", { range: "7d" }],
    queryFn: ({ signal }) => adminApi.getDashboardSummary({ range: "7d" }, signal),
    staleTime: 60_000,
  });
  const backupsQuery = useQuery({
    queryKey: ["admin", "maintenance", "backups", 5],
    queryFn: () => adminApi.listDatabaseBackups(5),
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", "recent"],
    queryFn: () => adminApi.listAuditLogs({ limit: 6 }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        flush
        actions={
          <Button asChild>
            <Link to="/admin/users">Manage users</Link>
          </Button>
        }
      />

      <SystemStatusStrip userSummaryQuery={userSummaryQuery} backupsQuery={backupsQuery} />

      <section aria-label="Team metrics">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300 lg:grid-cols-4">
          <OverviewMetricTile
            label="Overdue candidates"
            to="/admin/analytics"
            search={{ tab: "waiting" }}
            caption="Past their stage limit"
            tone={teamQuery.data && teamQuery.data.stuckTotal > 0 ? "alert" : "default"}
          >
            <OverviewMetricValue query={teamQuery}>
              {(data) => data.stuckTotal}
            </OverviewMetricValue>
          </OverviewMetricTile>

          <OverviewMetricTile
            label="Requests at risk"
            to="/admin/analytics"
            search={{ tab: "requests", health: "LATE" }}
            caption={
              teamQuery.data ? (
                <span className="tabular-nums">
                  {teamQuery.data.kpis.requisitions.overdue} overdue ·{" "}
                  {teamQuery.data.kpis.requisitions.atRisk} at risk
                </span>
              ) : undefined
            }
            tone={
              teamQuery.data && teamQuery.data.kpis.requisitions.overdue > 0 ? "alert" : "default"
            }
          >
            <OverviewMetricValue query={teamQuery}>
              {(data) => data.kpis.requisitions.overdue + data.kpis.requisitions.atRisk}
            </OverviewMetricValue>
          </OverviewMetricTile>

          <OverviewMetricTile
            label="Open seats"
            to="/admin/analytics"
            search={{ tab: "requests" }}
            caption={
              teamQuery.data ? (
                teamQuery.data.kpis.requestedSeats === 0 ? (
                  "No seats requested"
                ) : (
                  <span className="tabular-nums">
                    {formatSampled(
                      teamQuery.data.kpis.fillRate,
                      teamQuery.data.kpis.requestedSeats,
                      "%",
                    )}{" "}
                    filled
                  </span>
                )
              ) : undefined
            }
          >
            <OverviewMetricValue query={teamQuery}>
              {(data) => data.kpis.openSeats}
            </OverviewMetricValue>
          </OverviewMetricTile>

          <OverviewMetricTile label="Started this week" to="/admin/analytics" caption="Last 7 days">
            <OverviewMetricValue query={teamQuery}>
              {(data) => data.kpis.placementsStarted}
            </OverviewMetricValue>
          </OverviewMetricTile>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <section
          aria-labelledby="admin-recent-activity"
          className="overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          <OverviewPanelHeader
            id="admin-recent-activity"
            title="Recent activity"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/audit">View all</Link>
              </Button>
            }
          />
          <OverviewSectionData query={auditQuery} subject="recent activity">
            {(logs) =>
              logs.length === 0 ? (
                <EmptyState
                  bare
                  title="No recent activity"
                  description="Account and system changes will appear here."
                />
              ) : (
                <ul className="divide-y divide-slate-200">
                  {logs.map((log) => {
                    const target = formatTargetEntity(log);
                    const who = log.user
                      ? resolveUserName(log.user, "") ||
                        displayEmail(log.user.email) ||
                        formatAdminRole(log.user.role)
                      : "System";
                    const actionLabel = formatAction(log.action);
                    const targetLine = target.secondary
                      ? `${target.label} · ${target.secondary}`
                      : target.label;
                    return (
                      <li key={log.id}>
                        <Link
                          to="/admin/audit"
                          search={{ q: actionLabel } as never}
                          className="focus-ring-inset block px-3.5 py-2.5 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {actionLabel}
                            </p>
                            <time
                              dateTime={log.createdAt}
                              className="shrink-0 whitespace-nowrap text-xs text-slate-600 tabular-nums"
                            >
                              {formatDateTime(log.createdAt)}
                            </time>
                          </div>
                          <p
                            className="mt-0.5 truncate text-xs text-slate-600"
                            title={`${targetLine} · By ${who}`}
                          >
                            {targetLine} · By {who}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )
            }
          </OverviewSectionData>
        </section>

        <section
          aria-labelledby="admin-team-workload"
          className="overflow-hidden rounded-md border border-slate-300 bg-white"
        >
          <OverviewPanelHeader
            id="admin-team-workload"
            title="Team workload"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/analytics">View reports</Link>
              </Button>
            }
          />
          <OverviewSectionData query={teamQuery} subject="team workload">
            {(data) => {
              const hasUnassigned = Boolean(
                data.unassigned &&
                  (data.unassigned.requests > 0 ||
                    data.unassigned.overdue > 0 ||
                    data.unassigned.applicants > 0),
              );
              if (data.team.length === 0 && !hasUnassigned) {
                return (
                  <EmptyState
                    bare
                    title="No recruiters yet"
                    description="Recruiters will appear here once they are invited."
                  />
                );
              }
              const rows = [...data.team].sort(
                (a, b) => b.overdue - a.overdue || b.active - a.active,
              );
              const unassignedOverdue = data.unassigned
                ? data.unassigned.overdue + data.unassigned.overdueEstimated
                : 0;

              return (
                <ul className="divide-y divide-slate-200">
                  {rows.map((row) => (
                    <li key={row.recruiterId}>
                      <Link
                        to="/admin/analytics"
                        search={{ recruiterId: row.recruiterId, tab: "recruiters" } as never}
                        className="focus-ring-inset flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950" title={row.name}>
                            {row.name}
                          </p>
                          <p className="text-xs text-slate-600 tabular-nums">
                            {row.active} active ·{" "}
                            {row.requestedSeats === 0
                              ? "no seats requested"
                              : `${formatSampled(row.fillRate, row.requestedSeats, "%")} filled`}
                          </p>
                        </div>
                        <span
                          className={
                            row.overdue > 0
                              ? "shrink-0 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 tabular-nums"
                              : "shrink-0 text-xs text-slate-600 tabular-nums"
                          }
                        >
                          {row.overdue} overdue
                        </span>
                      </Link>
                    </li>
                  ))}
                  {hasUnassigned && data.unassigned && (
                    <li>
                      <Link
                        to="/admin/analytics"
                        search={{ tab: "requests" } as never}
                        className="focus-ring-inset flex items-center justify-between gap-3 bg-slate-50/70 px-3.5 py-2.5 text-sm transition-colors hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">Unassigned work</p>
                          <p className="text-xs text-slate-600 tabular-nums">
                            {data.unassigned.applicants} active · {data.unassigned.requests} open{" "}
                            {data.unassigned.requests === 1 ? "request" : "requests"}
                          </p>
                        </div>
                        <span
                          className={
                            unassignedOverdue > 0
                              ? "shrink-0 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 tabular-nums"
                              : "shrink-0 text-xs text-slate-600 tabular-nums"
                          }
                        >
                          {unassignedOverdue} overdue
                        </span>
                      </Link>
                    </li>
                  )}
                </ul>
              );
            }}
          </OverviewSectionData>
        </section>
      </div>
    </div>
  );
};
