import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import {
  Users,
  Briefcase,
  Calendar,
  Truck,
  AlertTriangle,
  ArrowRight,
  Plus,
} from "lucide-react";

function SectionData<T>({
  query,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isError && !query.isFetching) {
    return <ErrorState className="my-0 border-0" error={query.error} onRetry={() => { void query.refetch(); }} />;
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
      <div className="h-8 flex items-center gap-2">
        <span className="text-2xl font-sans font-bold text-slate-400" aria-label="Unavailable">—</span>
        <button
          type="button"
          onClick={() => { void query.refetch(); }}
          className="text-xs font-medium text-slate-900 underline hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
        >
          Try again
        </button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

export const TADashboard: React.FC = () => {
  const pipelineStatsQuery = useQuery({
    queryKey: ["ta", "analytics", "pipeline"],
    queryFn: taApi.getPipelineAnalytics,
  });

  const interviewSlaQuery = useQuery({
    queryKey: ["ta", "compliance", "interviews"],
    queryFn: taApi.checkInterviewCompliance,
  });

  const recentAppsQuery = useQuery({
    queryKey: ["ta", "applications", "recent", { page: 1, pageSize: 6, isArchived: false }],
    queryFn: ({ signal }) => taApi.listApplicationsPage({ page: 1, limit: 6, isArchived: false }, { signal }),
  });

  const dashboardCountsQuery = useQuery({
    queryKey: ["ta", "jobs", "dashboard-counts"],
    queryFn: ({ signal }) => taApi.getDashboardCounts({ signal }),
  });

  const slaData = interviewSlaQuery.data;
  const slaBreached = slaData?.summary?.breached || 0;
  const slaWarning = slaData?.summary?.warning || 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment overview"
        description="See active applications, interviews that need attention, and current job openings."
        breadcrumbs={[{ label: "Recruitment" }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Temporarily hidden - legacy talent pool implementation */}
            {/* <Link to="/ta/talent-pool">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Users className="w-3.5 h-3.5 text-teal-700" />}
              >
                Talent Pool
              </Button>
            </Link> */}
            <Link to="/ta/mrfs/create">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                New manpower request
              </Button>
            </Link>
          </div>
        }
      />

      {/* SLA Alert Banner if breached or warning. While the deadline check is pending,
          an invisible copy holds its space so the sections below do not jump when it arrives. */}
      {(interviewSlaQuery.isPending || slaBreached > 0 || slaWarning > 0) && (
        <div
          aria-hidden={interviewSlaQuery.isPending || undefined}
          className={`p-3 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3${interviewSlaQuery.isPending ? " invisible" : ""}`}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h4 className="text-xs font-mono font-bold text-amber-950 uppercase tracking-wide">
                7-day interview deadline ({slaBreached} overdue, {slaWarning} due soon)
              </h4>
              <p className="text-xs text-amber-900 leading-normal">
                Candidates must be screened and scheduled within 7 days of application receipt. Prompt action is required.
              </p>
            </div>
          </div>
          <Link to="/ta/interviews" className="shrink-0">
            <Button variant="primary" size="sm">
              View interview queue
            </Button>
          </Link>
        </div>
      )}

      {/* Unified 4-Segment Operational Metrics Ribbon */}
      <div className="border border-slate-300 bg-slate-300 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px">
        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Active Candidates
          </div>
          <div className="text-2xl font-sans font-bold text-slate-950 mt-0.5 tabular-nums">
            <MetricValue query={pipelineStatsQuery}>{(pipeline) => pipeline?.activeApplications || 0}</MetricValue>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Still moving through the pipeline</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Active Job Openings
          </div>
          <div className="text-2xl font-sans font-bold text-teal-950 mt-0.5 tabular-nums">
            <MetricValue query={dashboardCountsQuery}>{(counts) => counts?.openJobs ?? 0}</MetricValue>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Briefcase className="w-3 h-3 text-teal-700 shrink-0" />
            <span>Active client job openings</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Interview deadlines
          </div>
          <div className="text-2xl font-sans font-bold text-blue-950 mt-0.5 tabular-nums">
            <MetricValue query={interviewSlaQuery}>
              {(sla) => (
                <>
                  {sla?.summary?.healthy || 0}
                  <span className="text-xs text-slate-400 font-normal"> / {sla?.summary?.total || 0}</span>
                </>
              )}
            </MetricValue>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Calendar className="w-3 h-3 text-blue-700 shrink-0" />
            <span>{interviewSlaQuery.data ? `${slaBreached} overdue interviews` : interviewSlaQuery.isError ? "Overdue count unavailable" : "Checking deadlines"}</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Active Deployments
          </div>
          <div className="text-2xl font-sans font-bold text-emerald-950 mt-0.5 tabular-nums">
            <MetricValue query={dashboardCountsQuery}>{(counts) => counts?.activeDeployments ?? 0}</MetricValue>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Truck className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>On-site client personnel</span>
          </div>
        </div>
      </div>

      {/* Pipeline Stage Distribution Matrix */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-teal-700" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Hiring pipeline
            </h3>
            <span className="text-xs text-slate-500 font-sans hidden sm:inline">
              — Active candidates by hiring stage
            </span>
          </div>
          <Link to="/ta/applications">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              View all applications
            </Button>
          </Link>
        </div>

        <SectionData
          query={pipelineStatsQuery}
          skeleton={
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-300">
              {Array.from({ length: 6 }).map((_, i) => (
                // Same padding and line heights as the loaded stage tiles, so nothing moves when counts arrive.
                <div key={i} className="p-2.5 sm:p-3 bg-white flex flex-col items-center">
                  <div className="h-7 w-8 bg-slate-200" />
                  <div className="mt-0.5 h-[15px] w-16 bg-slate-100" />
                </div>
              ))}
            </div>
          }
        >
          {(pipeline) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-slate-300">
              {[
                { label: "Submitted", status: ApplicationStatus.SUBMITTED },
                { label: "Initial review", status: ApplicationStatus.INITIAL_SCREENING },
                { label: "Client review", status: ApplicationStatus.CLIENT_ENDORSEMENT },
                { label: "Final interview", status: ApplicationStatus.FINAL_INTERVIEW },
                { label: "Requirements", status: ApplicationStatus.COMPLIANCE },
                { label: "Deployed", status: ApplicationStatus.DEPLOYED },
              ].map((stage) => {
                const count = pipeline?.statusBreakdown?.[stage.status] || 0;
                return (
                  <Link
                    key={stage.status}
                    to="/ta/applications"
                    className="p-2.5 sm:p-3 bg-white hover:bg-teal-50/60 transition-colors text-center block group"
                    aria-label={`View ${stage.label} applications (${count})`}
                    search={{ stage: stage.status }}
                  >
                    <div className="text-xl font-sans font-bold text-slate-900 group-hover:text-teal-900 tabular-nums">
                      {count}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 uppercase tracking-wider font-semibold mt-0.5">
                      {stage.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionData>
      </div>

      {/* Urgent Action Queue */}
      <div className="w-full border border-slate-300 bg-white overflow-hidden">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-700" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Applications needing action
            </h3>
          </div>
          <Link to="/ta/applications">
            <Button variant="ghost" size="sm">
              View all applications →
            </Button>
          </Link>
        </div>

        <SectionData
          query={recentAppsQuery}
          skeleton={
            <div className="divide-y divide-slate-200">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[61px] px-3.5 py-2.5 space-y-1.5">
                  <div className="h-3.5 w-1/3 bg-slate-200" />
                  <div className="h-3 w-1/4 bg-slate-100" />
                </div>
              ))}
            </div>
          }
        >
          {(page) => {
            const recentApps = page?.items ?? [];
            return (
            recentApps.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Users className="w-5 h-5" />}
                  title="No pending candidates"
                  description="The candidate intake pipeline is up to date."
                />
              </div>
            ) : (
              <>
              <div className="divide-y divide-slate-200 md:hidden">
                {recentApps.map((app) => {
                  const profile = app.user?.applicantProfile;
                  const candidateName = profile
                    ? `${profile.firstName} ${profile.lastName}`
                    : app.user?.email || "Candidate";
                  const score = app.candidateFitScore ?? app.aiScore;
                  return (
                    <article key={app.id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-950 break-words">{candidateName}</h4>
                          <p className="mt-0.5 text-sm text-slate-600 break-words">{app.jobPosting?.title || "Job opening"}</p>
                        </div>
                        <StatusBadge status={app.status} size="sm" />
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-slate-500">Match score</dt>
                          <dd className="mt-0.5"><ScoreBadge score={score} size="sm" /></dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Applied</dt>
                          <dd className="mt-0.5 text-slate-800">{formatDate(app.createdAt)}</dd>
                        </div>
                      </dl>
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(app.id) }}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                      >
                        View application
                      </Link>
                    </article>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                    <tr>
                      <th className="px-3.5 py-2.5 font-bold">Candidate</th>
                      <th className="px-3.5 py-2.5 font-bold">Job opening</th>
                      <th className="px-3.5 py-2.5 font-bold">Status</th>
                      <th className="px-3.5 py-2.5 font-bold text-center">Match Score</th>
                      <th className="px-3.5 py-2.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentApps.map((app) => {
                      const profile = app.user?.applicantProfile;
                      const candidateName = profile
                        ? `${profile.firstName} ${profile.lastName}`
                        : app.user?.email || "Candidate";
                      const score = app.candidateFitScore ?? app.aiScore;

                      return (
                        <tr key={app.id} className="hover:bg-slate-100/70 transition-colors">
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-slate-950">{candidateName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Applied {formatDate(app.createdAt)}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="font-medium text-slate-900">
                              {app.jobPosting?.title || "Job opening"}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {app.jobPosting?.location || "Philippines"}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <ScoreBadge score={score} size="sm" />
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <Link
                              to="/ta/applications/$applicationId"
                              params={{ applicationId: String(app.id) }}
                            >
                              <Button variant="outline" size="sm">
                                View application
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )
            );
          }}
        </SectionData>
      </div>
    </div>
  );
};
