import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { employeesApi } from "../../lib/api/employees.api";
import { PageHeader, EmptyState, ErrorState } from "../../components/common";
import { Button } from "../../components/ui";
import { cn } from "../../lib/utils";
import { getManilaToday } from "../../lib/field-limits";
import { checkInDue } from "../../components/ta/check-in-due";
import { stageColor } from "../../lib/chart-palette";
import { ApplicationStatus, DeploymentStatus } from "../../lib/types/enums";
import { plural } from "../../lib/plural";
import { STAFF_STAGE_LABELS } from "../../lib/ta-copy";
import type { TAPendingActionItem } from "../../lib/types/analytics.types";
import { ChevronRight, Plus } from "lucide-react";

// One retry, so a failing section shows its error and retry control quickly instead of staying a skeleton.
const PAGE_QUERY = { retry: 1, retryDelay: 800 } as const;
const WORKLIST_TASK_LIMIT = 5;

function SectionData<T>({
  query,
  skeleton,
  subject,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton: React.ReactNode;
  /** What failed to load; the error shows as one inline row, like the worklist banner. */
  subject: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isError && !query.isFetching) {
    return <ErrorState compact subject={subject} error={query.error as Error} onRetry={() => { void query.refetch(); }} />;
  }
  if (query.isPending || query.isError) {
    return (
      <div role="status" aria-label="Loading section" className="motion-safe:animate-pulse">
        {skeleton}
        <span className="sr-only">Loading information</span>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

// Metric tile value: skeleton while pending, "—" plus retry on failure, never a fake 0.
function MetricValue<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => React.ReactNode }) {
  if (query.isPending || (query.isError && query.isFetching)) {
    return <div role="status" aria-label="Loading metric" className="h-8 w-14 bg-slate-200 motion-safe:animate-pulse" />;
  }
  if (query.isError) {
    return (
      <div className="flex h-8 items-center gap-2">
        <span className="text-2xl font-semibold text-slate-400" aria-label="Unavailable">—</span>
        <button
          type="button"
          onClick={() => { void query.refetch(); }}
          className="focus-ring relative z-10 min-h-11 px-1 text-xs font-medium text-slate-900 underline hover:text-slate-950 md:min-h-0"
        >
          Try again
        </button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

/** One headline number. The label is the link; it stretches over the whole tile, so there is one tab stop per tile. */
const MetricTile: React.FC<{
  label: string;
  to: string;
  search?: Record<string, string>;
  caption: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, to, search, caption, children }) => (
  <div className="relative bg-white p-3.5 transition-colors hover:bg-slate-50">
    <Link
      to={to}
      search={search as never}
      className="focus-ring-inset text-xs font-medium text-slate-600 after:absolute after:inset-0 after:content-['']"
    >
      {label}
    </Link>
    <div className="mt-1 font-display text-[2rem] font-semibold leading-9 tabular-nums text-slate-950">{children}</div>
    <div className="mt-1 text-xs text-slate-600">{caption}</div>
  </div>
);

const PanelHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex min-h-12 items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-3.5 py-1.5">
    <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
    {action}
  </div>
);

const WorkRow: React.FC<{
  to: string;
  search?: Record<string, string>;
  title: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "danger" | "warning" | "neutral";
}> = ({ to, search, title, detail, tone = "neutral" }) => (
  <li>
    <Link
      to={to}
      search={search as never}
      className="focus-ring-inset flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50"
    >
      <span className="min-w-0">
        <span
          className={cn(
            "block text-sm font-semibold",
            tone === "danger" ? "text-rose-700" : tone === "warning" ? "text-amber-800" : "text-slate-950"
          )}
        >
          {title}
        </span>
        {detail && <span className="block break-words text-xs text-slate-600">{detail}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  </li>
);

/** A labelled run of worklist rows. Empty groups are not drawn. */
const WorkGroup: React.FC<{ label: string; count: number; children: React.ReactNode }> = ({ label, count, children }) =>
  count === 0 ? null : (
    <div>
      <h3 className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700">
        {label}
        <span className="tabular-nums text-slate-500">{count}</span>
      </h3>
      <ul className="divide-y divide-slate-200 border-b border-slate-200 last:border-b-0">{children}</ul>
    </div>
  );

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
  ApplicationStatus.DEPLOYED,
] as const;

/** Which worklist group a pending task belongs to, by its deadline in Manila calendar days. */
const taskGroup = (task: TAPendingActionItem, today: string): "overdue" | "today" | "waiting" => {
  if (!task.deadline) return "waiting";
  const day = task.deadline.slice(0, 10);
  if (day < today) return "overdue";
  return day === today ? "today" : "waiting";
};

export const TADashboard: React.FC = () => {
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

  // Active deployments carry the next check-in date. The "ta/deployments" prefix is refreshed whenever one changes.
  const checkInsQuery = useQuery({
    queryKey: ["ta", "deployments", "active-check-ins"],
    queryFn: () => taApi.listDeployments({ status: DeploymentStatus.ACTIVE }),
    staleTime: 60_000,
    ...PAGE_QUERY,
  });

  const slaSummary = interviewSlaQuery.data?.summary;
  const slaBreached = slaSummary?.breached ?? 0;
  const slaWarning = slaSummary?.warning ?? 0;
  const needsPlacement = needsPlacementQuery.data?.stages?.NEEDS_PLACEMENT ?? 0;
  const tasks = tasksQuery.data?.pendingActions ?? [];
  const tasksTotal = tasksQuery.data?.pendingActionsTotal ?? tasks.length;
  const shownTasks = tasks.slice(0, WORKLIST_TASK_LIMIT);

  const today = getManilaToday();
  const checkInCounts = (checkInsQuery.data ?? []).reduce(
    (acc, dep) => {
      if (!dep.nextReviewAt) return acc;
      const due = checkInDue(dep.nextReviewAt);
      if (due.overdue) acc.overdue += 1;
      else if (due.label === "Due today") acc.today += 1;
      return acc;
    },
    { overdue: 0, today: 0 },
  );

  const tasksIn = (group: "overdue" | "today" | "waiting") => shownTasks.filter((t) => taskGroup(t, today) === group);
  const overdueTasks = tasksIn("overdue");
  const todayTasks = tasksIn("today");
  const waitingTasks = tasksIn("waiting");

  const overdueCount = slaBreached + checkInCounts.overdue + overdueTasks.length;
  const todayCount = slaWarning + checkInCounts.today + todayTasks.length;
  const waitingCount = needsPlacement + waitingTasks.length;

  const worklistQueries = [interviewSlaQuery, needsPlacementQuery, tasksQuery, checkInsQuery];
  const worklistLoading = worklistQueries.some((q) => q.isPending && !q.isError);
  const failedQueries = worklistQueries.filter((q) => q.isError && !q.isFetching);
  const hasWork = overdueCount + todayCount + waitingCount > 0;
  const moreTasks = tasksTotal > shownTasks.length;

  const latestUpdate = Math.max(0, ...[pipelineStatsQuery, interviewSlaQuery, dashboardCountsQuery, tasksQuery].map((q) => q.dataUpdatedAt));
  const asOf = latestUpdate
    ? `As of ${new Date(latestUpdate).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
    : undefined;

  const taskRow = (task: TAPendingActionItem) => (
    <WorkRow
      key={task.id}
      to={task.targetUrl}
      tone={task.urgency === "HIGH" ? "danger" : "neutral"}
      title={task.title}
      detail={taskDetail(task)}
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Overview"
        description={asOf}
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

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        {/* Needs your action: the worklist. On a phone it comes first; on a tablet the numbers lead. */}
        <section aria-label="Needs your action" className="overflow-hidden rounded-md border border-slate-300 bg-white">
          <PanelHeader
            title="Needs your action"
            action={
              moreTasks ? (
                <Button asChild variant="ghost" size="sm" className="max-md:min-h-11">
                  <Link to="/ta/analytics">
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
              {hasWork ? (
                <>
                  <WorkGroup label="Overdue" count={overdueCount}>
                    {slaBreached > 0 && (
                      <WorkRow to="/ta/interviews" tone="danger" title={`${plural(slaBreached, "interview")} overdue`} detail="Results are due 7 days after the interview is scheduled." />
                    )}
                    {checkInCounts.overdue > 0 && (
                      <WorkRow
                        to="/ta/workforce"
                        search={{ tab: "deployments" }}
                        tone="danger"
                        title={`${plural(checkInCounts.overdue, "check-in")} overdue`}
                        detail="Active deployments past their next check-in date."
                      />
                    )}
                    {overdueTasks.map(taskRow)}
                  </WorkGroup>
                  <WorkGroup label="Due soon" count={todayCount}>
                    {slaWarning > 0 && (
                      <WorkRow to="/ta/interviews" tone="warning" title={`${plural(slaWarning, "interview")} due within 48 hours`} />
                    )}
                    {checkInCounts.today > 0 && (
                      <WorkRow
                        to="/ta/workforce"
                        search={{ tab: "deployments" }}
                        title={`${plural(checkInCounts.today, "check-in")} due today`}
                      />
                    )}
                    {todayTasks.map(taskRow)}
                  </WorkGroup>
                  <WorkGroup label="Waiting" count={waitingCount}>
                    {needsPlacement > 0 && (
                      <WorkRow
                        to="/ta/workforce"
                        search={{ tab: "redeployment" }}
                        title={`${plural(needsPlacement, "worker")} ${needsPlacement === 1 ? "needs" : "need"} placement`}
                        detail="Ended assignments waiting for a new job."
                      />
                    )}
                    {waitingTasks.map(taskRow)}
                  </WorkGroup>
                </>
              ) : failedQueries.length === 0 ? (
                <EmptyState
                  bare
                  title="Nothing needs your action"
                  description="No overdue interviews, document reviews, client answers or workers waiting for a placement."
                />
              ) : null}
            </>
          )}
        </section>

        <div className="space-y-5 md:max-lg:order-first">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300">
            <MetricTile label="Active candidates" to="/ta/applications" caption="In the pipeline">
              <MetricValue query={pipelineStatsQuery}>{(pipeline) => pipeline?.activeApplications || 0}</MetricValue>
            </MetricTile>

            <MetricTile label="Active job openings" to="/ta/jobs" caption="Open to applicants">
              <MetricValue query={dashboardCountsQuery}>{(counts) => counts?.openJobs ?? 0}</MetricValue>
            </MetricTile>

            <MetricTile
              label="Interview deadlines"
              to="/ta/interviews"
              caption={
                interviewSlaQuery.data
                  ? `overdue, of ${plural(slaSummary?.total || 0, "open interview")}`
                  : interviewSlaQuery.isError
                    ? "Overdue count unavailable"
                    : "Checking deadlines"
              }
            >
              <MetricValue query={interviewSlaQuery}>
                {() => <span className={slaBreached > 0 ? "text-rose-700" : undefined}>{slaBreached}</span>}
              </MetricValue>
            </MetricTile>

            <MetricTile label="Active deployments" to="/ta/workforce" search={{ tab: "deployments" }} caption="On assignment">
              <MetricValue query={dashboardCountsQuery}>{(counts) => counts?.activeDeployments ?? 0}</MetricValue>
            </MetricTile>
          </div>

          <section aria-label="Hiring pipeline" className="overflow-hidden rounded-md border border-slate-300 bg-white">
            <PanelHeader
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

            <SectionData
              query={pipelineStatsQuery}
              subject="the hiring pipeline"
              skeleton={
                <div className="divide-y divide-slate-200">
                  {Array.from({ length: STAGE_TILES.length }).map((_, i) => (
                    <div key={i} className="flex min-h-11 items-center justify-between px-3.5">
                      <div className="h-3.5 w-24 bg-slate-100" />
                      <div className="h-4 w-6 bg-slate-200" />
                    </div>
                  ))}
                </div>
              }
            >
              {(pipeline) => {
                const counts = STAGE_TILES.map((status) => pipeline?.statusBreakdown?.[status] || 0);
                const max = Math.max(1, ...counts);
                return (
                  <ul className="divide-y divide-slate-200">
                    {STAGE_TILES.map((status, i) => {
                      const label = STAFF_STAGE_LABELS[status];
                      const count = counts[i];
                      return (
                        <li key={status}>
                          <Link
                            to="/ta/applications"
                            search={{ stage: status }}
                            aria-label={`View ${label} applications (${count})`}
                            className="focus-ring-inset block min-h-11 px-3.5 py-2 transition-colors hover:bg-slate-50"
                          >
                            <span className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-800">
                                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: stageColor(status) }} />
                                {label}
                              </span>
                              <span className="font-semibold tabular-nums text-slate-950">{count}</span>
                            </span>
                            <span aria-hidden="true" className="mt-1.5 block h-1 rounded-full bg-slate-100">
                              <span
                                className="block h-1 rounded-full"
                                style={{ width: `${(count / max) * 100}%`, backgroundColor: stageColor(status) }}
                              />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                );
              }}
            </SectionData>
          </section>
        </div>
      </div>
    </div>
  );
};
