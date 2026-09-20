import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  ScoreBadge,
  LoadingState,
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
    queryKey: ["ta", "applications", "recent"],
    queryFn: () => taApi.listApplications({ limit: 6, isArchived: false }),
  });

  const openJobsQuery = useQuery({
    queryKey: ["ta", "jobs", "open"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
  });

  const deploymentsQuery = useQuery({
    queryKey: ["ta", "deployments", "active"],
    queryFn: () => taApi.listDeployments({ status: "ACTIVE" }),
  });

  const isLoading =
    pipelineStatsQuery.isLoading ||
    interviewSlaQuery.isLoading ||
    recentAppsQuery.isLoading ||
    openJobsQuery.isLoading ||
    deploymentsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recruitment overview"
          description="Loading your recruitment work..."
        />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={5} />
      </div>
    );
  }

  const isError =
    pipelineStatsQuery.isError ||
    interviewSlaQuery.isError ||
    recentAppsQuery.isError ||
    openJobsQuery.isError ||
    deploymentsQuery.isError;

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recruitment overview"
          description="Your recruitment work"
        />
        <ErrorState
          error={
            pipelineStatsQuery.error ||
            interviewSlaQuery.error ||
            recentAppsQuery.error
          }
          onRetry={() => {
            pipelineStatsQuery.refetch();
            interviewSlaQuery.refetch();
            recentAppsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const pipeline = pipelineStatsQuery.data;
  const slaData = interviewSlaQuery.data;
  const rawRecent = recentAppsQuery.data;
  const recentApps: any[] = Array.isArray(rawRecent) ? rawRecent : (rawRecent as any)?.data || [];
  const openJobs = openJobsQuery.data || [];
  const activeDeployments = deploymentsQuery.data || [];

  const totalActive = pipeline?.totalApplications || 0;
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
            <Link to="/ta/talent-pool">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Users className="w-3.5 h-3.5 text-teal-700" />}
              >
                Talent Pool
              </Button>
            </Link>
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

      {/* SLA Alert Banner if breached or warning */}
      {(slaBreached > 0 || slaWarning > 0) && (
        <div className="p-3 bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
            {totalActive}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Across all recruitment stages</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Active Job Openings
          </div>
          <div className="text-2xl font-sans font-bold text-teal-950 mt-0.5 tabular-nums">
            {openJobs.length}
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
            {slaData?.summary?.healthy || 0}
            <span className="text-xs text-slate-400 font-normal"> / {slaData?.summary?.total || 0}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Calendar className="w-3 h-3 text-blue-700 shrink-0" />
            <span>{slaBreached} overdue interviews</span>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Active Deployments
          </div>
          <div className="text-2xl font-sans font-bold text-emerald-950 mt-0.5 tabular-nums">
            {activeDeployments.length}
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

        {recentApps.length === 0 ? (
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
              const score = app.candidateFitScore ?? app.candidateScores?.[0]?.finalFitScore ?? app.aiScore;
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
                  const score = app.candidateFitScore ?? app.candidateScores?.[0]?.finalFitScore ?? app.aiScore;

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
        )}
      </div>
    </div>
  );
};
