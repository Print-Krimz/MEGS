import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { employeesApi } from "../../lib/api/employees.api";
import { PageHeader, StatusBadge, EmptyState } from "../../components/common";
import { Button } from "../../components/ui";
import { cn, formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
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
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-950">
        <span>Couldn't load {subject}.</span>
        <Button variant="outline" size="sm" onClick={() => { void query.refetch(); }}>
          Try again
        </Button>
      </div>
    );
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
    <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-950">{children}</div>
    <div className="mt-0.5 text-xs text-slate-600">{caption}</div>
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

  const recentAppsQuery = useQuery({
    queryKey: ["ta", "applications", "recent", { page: 1, pageSize: 5, isArchived: false }],
    queryFn: ({ signal }) => taApi.listApplicationsPage({ page: 1, limit: 5, isArchived: false }, { signal }),
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

  const slaSummary = interviewSlaQuery.data?.summary;
  const slaBreached = slaSummary?.breached ?? 0;
  const slaWarning = slaSummary?.warning ?? 0;
  const needsPlacement = needsPlacementQuery.data?.stages?.NEEDS_PLACEMENT ?? 0;
  const tasks = tasksQuery.data?.pendingActions ?? [];
  const tasksTotal = tasksQuery.data?.pendingActionsTotal ?? tasks.length;

  const worklistQueries = [interviewSlaQuery, needsPlacementQuery, tasksQuery];
  const worklistLoading = worklistQueries.some((q) => q.isPending && !q.isError);
  const failedQueries = worklistQueries.filter((q) => q.isError && !q.isFetching);
  const hasWork = slaBreached > 0 || slaWarning > 0 || needsPlacement > 0 || tasks.length > 0;

  const latestUpdate = Math.max(0, ...[pipelineStatsQuery, interviewSlaQuery, dashboardCountsQuery, tasksQuery].map((q) => q.dataUpdatedAt));
  const asOf = latestUpdate
    ? `As of ${new Date(latestUpdate).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}`
    : undefined;

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

      {/* Needs your action: the worklist, so the first screen says what to do next. */}
      <section className="border border-slate-300 bg-white">
        <PanelHeader title="Needs your action" />
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
              <ul className="divide-y divide-slate-200">
                {slaBreached > 0 && (
                  <WorkRow
                    to="/ta/interviews"
                    tone="danger"
                    title={`${plural(slaBreached, "interview")} overdue`}
                    detail="Results are due 7 days after the interview is scheduled."
                  />
                )}
                {slaWarning > 0 && (
                  <WorkRow to="/ta/interviews" tone="warning" title={`${plural(slaWarning, "interview")} due within 48 hours`} />
                )}
                {needsPlacement > 0 && (
                  <WorkRow
                    to="/ta/workforce"
                    search={{ tab: "redeployment" }}
                    title={`${plural(needsPlacement, "worker")} ${needsPlacement === 1 ? "needs" : "need"} placement`}
                    detail="Ended assignments waiting for a new job."
                  />
                )}
                {tasks.slice(0, WORKLIST_TASK_LIMIT).map((task) => (
                  <WorkRow
                    key={task.id}
                    to={task.targetUrl}
                    tone={task.urgency === "HIGH" ? "danger" : "neutral"}
                    title={task.title}
                    detail={taskDetail(task)}
                  />
                ))}
              </ul>
            ) : failedQueries.length === 0 ? (
              <EmptyState
                bare
                title="Nothing needs your action"
                description="No overdue interviews, document reviews, client answers or workers waiting for a placement."
              />
            ) : null}
            {tasksTotal > Math.min(tasks.length, WORKLIST_TASK_LIMIT) && (
              <div className="border-t border-slate-200 px-3.5 py-2">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/ta/analytics">
                    See all {plural(tasksTotal, "pending task")}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 gap-px border border-slate-300 bg-slate-300 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Active candidates" to="/ta/applications" caption="Still moving through the pipeline">
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

        <MetricTile label="Active deployments" to="/ta/workforce" search={{ tab: "deployments" }} caption="On-site client personnel">
          <MetricValue query={dashboardCountsQuery}>{(counts) => counts?.activeDeployments ?? 0}</MetricValue>
        </MetricTile>
      </div>

      <section className="border border-slate-300 bg-white">
        <PanelHeader
          title="Hiring pipeline"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/ta/applications">
                View all applications
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          }
        />

        <SectionData
          query={pipelineStatsQuery}
          subject="the hiring pipeline"
          skeleton={
            <div className="grid grid-cols-2 gap-px bg-slate-300 sm:grid-cols-7">
              {Array.from({ length: STAGE_TILES.length }).map((_, i) => (
                // Same padding and line heights as the loaded stage tiles, so nothing moves when counts arrive.
                <div key={i} className="flex min-h-[4.5rem] flex-col items-center bg-white p-2.5 sm:p-3">
                  <div className="h-7 w-8 bg-slate-200" />
                  <div className="mt-0.5 h-[15px] w-16 bg-slate-100" />
                </div>
              ))}
            </div>
          }
        >
          {(pipeline) => (
            <div className="grid grid-cols-2 gap-px bg-slate-300 sm:grid-cols-7">
              {STAGE_TILES.map((status) => {
                const label = STAFF_STAGE_LABELS[status];
                const count = pipeline?.statusBreakdown?.[status] || 0;
                return (
                  <Link
                    key={status}
                    to="/ta/applications"
                    search={{ stage: status }}
                    aria-label={`View ${label} applications (${count})`}
                    className="focus-ring-inset block min-h-[4.5rem] bg-white p-2.5 text-center max-sm:last:col-span-2 transition-colors hover:bg-slate-50 sm:p-3"
                  >
                    <div className="text-xl font-semibold tabular-nums text-slate-950">{count}</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-600">{label}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionData>
      </section>

      <section className="border border-slate-300 bg-white">
        <PanelHeader
          title="Recent applications"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/ta/applications">
                View all
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          }
        />

        <SectionData
          query={recentAppsQuery}
          subject="recent applications"
          skeleton={
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 space-y-1.5 px-3.5 py-2.5">
                  <div className="h-3.5 w-1/3 bg-slate-200" />
                  <div className="h-3 w-1/4 bg-slate-100" />
                </div>
              ))}
            </div>
          }
        >
          {(page) => {
            const recentApps = page?.items ?? [];
            return recentApps.length === 0 ? (
              <EmptyState
                bare
                title="No applications yet"
                description="New applications will appear here."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/ta/mrfs/create">Create manpower request</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-slate-200">
                {recentApps.map((app) => {
                  const profile = app.user?.applicantProfile;
                  const candidateName = profile ? `${profile.firstName} ${profile.lastName}` : app.user?.email || "Candidate";
                  return (
                    <li key={app.id}>
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(app.id) }}
                        className="focus-ring-inset flex min-h-14 items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50"
                      >
                        <span className="min-w-0">
                          <span className="block break-words text-sm font-semibold text-slate-950">{candidateName}</span>
                          <span className="block break-words text-xs text-slate-600">
                            {app.jobPosting?.title || "Job opening"} · Applied {formatDate(app.createdAt)}
                          </span>
                        </span>
                        <StatusBadge status={app.status} size="sm" />
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
  );
};
