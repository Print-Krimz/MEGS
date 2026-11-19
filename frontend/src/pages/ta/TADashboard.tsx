import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  EmptyState,
  OverviewSectionData,
  OverviewMetricValue,
  OverviewMetricTile,
  OverviewPanelHeader,
} from "../../components/common";
import { Button } from "../../components/ui";
import { cn } from "../../lib/utils";
import { getManilaToday } from "../../lib/field-limits";
import { stageColor } from "../../lib/chart-palette";
import { ComingUp } from "../../components/ta/overview/ComingUp";
import { ApplicationStatus, DeploymentStatus } from "../../lib/types/enums";
import { plural } from "../../lib/plural";
import { STAFF_STAGE_LABELS, TA_COPY } from "../../lib/ta-copy";
import type { TAPendingActionItem } from "../../lib/types/analytics.types";
import { ChevronRight, Plus } from "lucide-react";

// One retry, so a failing section shows its error and retry control quickly instead of staying a skeleton.
const PAGE_QUERY = { retry: 1, retryDelay: 800 } as const;
const WORKLIST_TASK_LIMIT = 5;

type UrgencyFilter = "all" | "overdue" | "today" | "todo";

interface QueueItem {
  key: string;
  label: string;
  to: string;
  search: Record<string, string>;
  tone: "danger" | "warning" | "neutral";
}

const taskDetail = (task: TAPendingActionItem) => {
  const parts = [task.candidateName, task.jobTitle];
  if (task.agingDays !== undefined && task.agingDays > 0) parts.push(`${plural(task.agingDays, "day")} waiting`);
  return parts.join(" · ");
};

const STAGE_TILES = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.INITIAL_SCREENING,
  ApplicationStatus.CLIENT_ENDORSEMENT,
  ApplicationStatus.FINAL_INTERVIEW,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.CONTRACT_SIGNING,
] as const;

/** Which worklist group a pending task belongs to, by its deadline in Manila calendar days. */
const taskGroup = (task: TAPendingActionItem, today: string): "overdue" | "today" | "todo" => {
  if (!task.deadline) return "todo";
  const day = task.deadline.slice(0, 10);
  if (day < today) return "overdue";
  return day === today ? "today" : "todo";
};

export const TADashboard: React.FC = () => {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");

  const pipelineStatsQuery = useQuery({
    queryKey: ["ta", "analytics", "pipeline"],
    queryFn: taApi.getPipelineAnalytics,
    ...PAGE_QUERY,
  });

  const interviewSlaQuery = useQuery({
    // Only the summary is shown, so ask for a single-row page instead of every interview.
    queryKey: ["ta", "compliance", "interviews", "summary"],
    queryFn: ({ signal }) => taApi.listInterviewCompliancePage({ page: 1, pageSize: 1 }, { signal }),
    ...PAGE_QUERY,
  });

  const dashboardCountsQuery = useQuery({
    queryKey: ["ta", "jobs", "dashboard-counts"],
    queryFn: ({ signal }) => taApi.getDashboardCounts({ signal }),
    ...PAGE_QUERY,
  });

  // Same key and fetcher as the sidebar badge and the Workforce page summary, so the cache is shared.
  const needsPlacementQuery = useQuery({
    queryKey: ["ta", "redeployment-queue", "summary"],
    queryFn: ({ signal }) => employeesApi.getRedeploymentQueueSummary({ signal }),
    staleTime: 60_000,
    ...PAGE_QUERY,
  });

  // Same key and default filter as the Reports page, so opening Reports straight after reuses this result.
  const tasksQuery = useQuery({
    queryKey: ["ta", "analytics", "dashboard", { range: "7d" }],
    queryFn: ({ signal }) => taApi.getDashboardSummary({ range: "7d" }, signal),
    staleTime: 60_000,
    ...PAGE_QUERY,
  });

  // Active deployments feed "Contracts ending" in Coming up. The "ta/deployments" prefix is refreshed whenever one changes.
  const activeDeploymentsQuery = useQuery({
    queryKey: ["ta", "deployments", "active"],
    queryFn: () => taApi.listDeployments({ status: DeploymentStatus.ACTIVE }),
    staleTime: 60_000,
    ...PAGE_QUERY,
  });

  const complianceQuery = useQuery({
    queryKey: ["ta", "analytics", "compliance", "COMPLIANCE"],
    queryFn: () => taApi.getComplianceOverview({ stage: "COMPLIANCE" }),
    staleTime: 60_000,
    ...PAGE_QUERY,
  });

  const slaSummary = interviewSlaQuery.data?.summary;
  const slaBreached = slaSummary?.breached ?? 0;
  const slaWarning = slaSummary?.warning ?? 0;
  const needsPlacement = needsPlacementQuery.data?.stages?.NEEDS_PLACEMENT ?? 0;
  const awaitingComplianceReview = complianceQuery.data?.statusBreakdown?.SUBMITTED ?? 0;
  const tasks = tasksQuery.data?.pendingActions ?? [];
  const tasksTotal = tasksQuery.data?.pendingActionsTotal ?? tasks.length;
  const shownTasks = tasks.slice(0, WORKLIST_TASK_LIMIT);

  const today = getManilaToday();

  const tasksIn = (group: "overdue" | "today" | "todo") => shownTasks.filter((t) => taskGroup(t, today) === group);
  const overdueTasks = tasksIn("overdue");
  const todayTasks = tasksIn("today");
  const todoTasks = tasksIn("todo");

  const queueItems: QueueItem[] = [];
  if (slaBreached > 0) {
    queueItems.push({
      key: "sla-breached",
      label: `${plural(slaBreached, "interview")} overdue`,
      to: "/ta/interviews",
      search: { status: "BREACHED" },
      tone: "danger",
    });
  }
  if (slaWarning > 0) {
    queueItems.push({
      key: "sla-warning",
      label: `${plural(slaWarning, "interview")} due within 48 hours`,
      to: "/ta/interviews",
      search: { status: "WARNING" },
      tone: "warning",
    });
  }
  if (awaitingComplianceReview > 0) {
    queueItems.push({
      key: "compliance-review",
      label: `${awaitingComplianceReview} pre-employment ${awaitingComplianceReview === 1 ? "document" : "documents"} awaiting review`,
      to: "/ta/requirements",
      search: { status: "SUBMITTED" },
      tone: "neutral",
    });
  }
  if (needsPlacement > 0) {
    queueItems.push({
      key: "needs-placement",
      label: `${plural(needsPlacement, "worker")} ${needsPlacement === 1 ? "needs" : "need"} placement`,
      to: "/ta/workforce",
      search: { tab: "redeployment" },
      tone: "neutral",
    });
  }

  const urgencyTabs: { key: UrgencyFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: shownTasks.length },
    { key: "overdue", label: "Overdue", count: overdueTasks.length },
    { key: "today", label: "Due soon", count: todayTasks.length },
    { key: "todo", label: "To do", count: todoTasks.length },
  ];

  const visibleTasks =
    urgencyFilter === "all" ? shownTasks : shownTasks.filter((t) => taskGroup(t, today) === urgencyFilter);

  const worklistQueries = [interviewSlaQuery, needsPlacementQuery, tasksQuery, complianceQuery];
  const worklistLoading = worklistQueries.some((q) => q.isPending && !q.isError);
  const failedQueries = worklistQueries.filter((q) => q.isError && !q.isFetching);
  const moreTasks = tasksTotal > shownTasks.length;

  const latestUpdate = Math.max(
    0,
    ...[pipelineStatsQuery, interviewSlaQuery, dashboardCountsQuery, tasksQuery].map((q) => q.dataUpdatedAt),
  );
  const asOf = latestUpdate
    ? `As of ${new Date(latestUpdate).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
    : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={TA_COPY.pageTitles.overview}
        meta={asOf ? <span className="text-xs text-slate-600 tabular-nums">{asOf}</span> : undefined}
        flush
        actions={
          <Button asChild variant="primary" size="sm">
            <Link to="/ta/mrfs/create">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New manpower request
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300 lg:grid-cols-4">
        <OverviewMetricTile label="Active candidates" to="/ta/applications" caption="In the pipeline">
          <OverviewMetricValue query={pipelineStatsQuery}>{(pipeline) => pipeline?.activeApplications || 0}</OverviewMetricValue>
        </OverviewMetricTile>

        <OverviewMetricTile label="Active job openings" to="/ta/jobs" caption="Open to applicants">
          <OverviewMetricValue query={dashboardCountsQuery}>{(counts) => counts?.openJobs ?? 0}</OverviewMetricValue>
        </OverviewMetricTile>

        <OverviewMetricTile
          label="Seats to fill"
          to="/ta/mrfs"
          caption={
            tasksQuery.data
              ? tasksQuery.data.kpis.requestedSeats > 0
                ? `of ${tasksQuery.data.kpis.requestedSeats} requested`
                : "No open requests"
              : tasksQuery.isError
                ? "Seat count unavailable"
                : "Counting seats"
          }
        >
          <OverviewMetricValue query={tasksQuery}>{(summary) => summary.kpis.openSeats}</OverviewMetricValue>
        </OverviewMetricTile>

        <OverviewMetricTile
          label="Active deployments"
          to="/ta/workforce"
          search={{ tab: "deployments" }}
          caption="On assignment"
        >
          <OverviewMetricValue query={dashboardCountsQuery}>{(counts) => counts?.activeDeployments ?? 0}</OverviewMetricValue>
        </OverviewMetricTile>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <section aria-label="Needs your action" className="flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white">
          <OverviewPanelHeader
            title="Needs your action"
            action={
              moreTasks ? (
                <Button asChild variant="ghost" size="sm" className="max-md:min-h-11">
                  <Link to="/ta/analytics" search={{ tab: "actions" }}>
                    See all {plural(tasksTotal, "pending task")}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              ) : undefined
            }
          />
          {worklistLoading ? (
            <div role="status" aria-label="Loading section" className="divide-y divide-slate-200 motion-safe:animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 space-y-1.5 px-3.5 py-3">
                  <div className="h-3.5 w-1/3 bg-slate-200" />
                  <div className="h-3 w-1/4 bg-slate-100" />
                </div>
              ))}
              <span className="sr-only">Loading information</span>
            </div>
          ) : (
            <>
              {failedQueries.length > 0 && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950">
                  <span>Some items could not be loaded, so this list may be incomplete.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => failedQueries.forEach((q) => { void q.refetch(); })}
                  >
                    Try again
                  </Button>
                </div>
              )}

              {queueItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3.5 py-2">
                  <span className="text-xs font-medium text-slate-600">Queues:</span>
                  {queueItems.map((item) => (
                    <Link
                      key={item.key}
                      to={item.to}
                      search={item.search as never}
                      className={cn(
                        "focus-ring inline-flex min-h-8 items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors max-md:min-h-11",
                        item.tone === "danger"
                          ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                          : item.tone === "warning"
                            ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}

              {shownTasks.length > 0 ? (
                <>
                  <div
                    role="group"
                    aria-label="Filter action items"
                    className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3.5 py-2"
                  >
                    {urgencyTabs.map((tab) => {
                      const active = urgencyFilter === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setUrgencyFilter(tab.key)}
                          className={cn(
                            "focus-ring inline-flex min-h-8 items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors max-md:min-h-11",
                            active
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-950",
                          )}
                        >
                          <span>{tab.label}</span>
                          <span className={cn("tabular-nums", active ? "text-slate-200" : "text-slate-600")}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {visibleTasks.length > 0 ? (
                    <ul className="divide-y divide-slate-200">
                      {visibleTasks.map((task) => {
                        const group = taskGroup(task, today);
                        const isOverdue = group === "overdue";
                        const isDueSoon = group === "today";
                        const isUrgent = isOverdue || task.urgency === "HIGH";
                        const urgencyText = isOverdue ? "Overdue" : isDueSoon ? "Due soon" : null;
                        return (
                          <li key={task.id}>
                            <Link
                              to={task.targetUrl}
                              className="focus-ring-inset flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50"
                            >
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span
                                    className={cn(
                                      "text-sm font-semibold",
                                      isUrgent ? "text-rose-700" : isDueSoon ? "text-amber-800" : "text-slate-950",
                                    )}
                                  >
                                    {task.title}
                                  </span>
                                  {urgencyText && (
                                    <span className={cn("text-xs font-medium", isOverdue ? "text-rose-700" : "text-amber-800")}>
                                      {urgencyText}
                                    </span>
                                  )}
                                </span>
                                <span className="block truncate text-xs text-slate-600">{taskDetail(task)}</span>
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="px-3.5 py-4 text-sm text-slate-600">No items in this view.</p>
                  )}
                </>
              ) : queueItems.length === 0 && failedQueries.length === 0 ? (
                <EmptyState
                  bare
                  title="Nothing needs your action right now."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link to="/ta/applications">Open applications</Link>
                    </Button>
                  }
                />
              ) : null}
            </>
          )}
        </section>

        <section aria-label="Hiring pipeline" className="flex flex-col overflow-hidden rounded-md border border-slate-300 bg-white">
          <OverviewPanelHeader
            title="Hiring pipeline"
            action={
              <Button asChild variant="ghost" size="sm" className="max-md:min-h-11">
                <Link to="/ta/applications">
                  All applications
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </Button>
            }
          />

          <OverviewSectionData
            query={pipelineStatsQuery}
            subject="the hiring pipeline"
            skeleton={
              <div className="divide-y divide-slate-200">
                {Array.from({ length: STAGE_TILES.length + 1 }).map((_, i) => (
                  <div key={i} className="flex min-h-10 items-center justify-between px-3.5">
                    <div className="h-3.5 w-24 bg-slate-100" />
                    <div className="h-4 w-6 bg-slate-200" />
                  </div>
                ))}
              </div>
            }
          >
            {(pipeline) => {
              const counts = STAGE_TILES.map((status) => pipeline?.statusBreakdown?.[status] || 0);
              // Workers who passed contract signing but have not started yet. Placements already working or finished are not pipeline.
              const awaitingStart = dashboardCountsQuery.data?.awaitingStart ?? 0;
              const max = Math.max(1, awaitingStart, ...counts);
              const rows = [
                ...STAGE_TILES.map((status, i) => ({
                  key: status,
                  label: STAFF_STAGE_LABELS[status],
                  count: counts[i],
                  color: stageColor(status),
                  to: "/ta/applications",
                  search: { stage: status },
                  ariaLabel: `View ${STAFF_STAGE_LABELS[status]} applications (${counts[i]})`,
                })),
                {
                  key: "AWAITING_START",
                  label: "Awaiting start",
                  count: awaitingStart,
                  color: stageColor(ApplicationStatus.DEPLOYED),
                  to: "/ta/workforce",
                  search: { tab: "deployments" },
                  ariaLabel: `View deployments awaiting start (${awaitingStart})`,
                },
              ];

              return (
                <ul className="flex flex-1 flex-col divide-y divide-slate-200">
                  {rows.map((row) => (
                    <li key={row.key} className="flex flex-1">
                      <Link
                        to={row.to}
                        search={row.search as never}
                        aria-label={row.ariaLabel}
                        className="focus-ring-inset flex min-h-11 flex-1 items-center gap-3 px-3.5 py-2 transition-colors hover:bg-slate-50 md:min-h-10"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: row.color }} />
                          <span className="truncate font-medium text-slate-800">{row.label}</span>
                        </span>
                        <span className="flex w-28 shrink-0 items-center gap-2.5">
                          <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-1.5 rounded-full"
                              style={{
                                width: row.count > 0 ? `${(row.count / max) * 100}%` : "0%",
                                backgroundColor: row.color,
                              }}
                            />
                          </span>
                          <span
                            className={cn(
                              "w-7 text-right text-sm tabular-nums",
                              row.count > 0 ? "font-semibold text-slate-950" : "font-medium text-slate-600",
                            )}
                          >
                            {row.count}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            }}
          </OverviewSectionData>
        </section>

        <div className="lg:col-span-2">
          <ComingUp deploymentsQuery={activeDeploymentsQuery} />
        </div>
      </div>
    </div>
  );
};
