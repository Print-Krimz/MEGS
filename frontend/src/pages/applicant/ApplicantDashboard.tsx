import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { applicantApi } from "../../lib/api/applicant.api";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  ErrorState,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate, getTimeBasedGreeting, formatSalaryRange } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import {
  Briefcase,
  AlertCircle,
  Mail,
  ArrowRight,
  CheckCircle2,
  Building,
  MapPin,
  Calendar,
} from "lucide-react";
import { computeProfileHealth } from "../../lib/profile-health";
import {
  getApplicationRefetchInterval,
  INVITATION_POLL_MS,
  pollInterval,
} from "../../lib/query-policies";
import { useLiveStreamConnected } from "../../lib/live-stream-status";

function SectionData<T>({
  query,
  subject,
  skeleton,
  errorClassName,
  children,
}: {
  query: UseQueryResult<T>;
  /** What this section shows, for the error title ("Couldn't load <subject>"). */
  subject: string;
  skeleton: React.ReactNode;
  /** Spacing for the error banner when the section sits inside a card. */
  errorClassName?: string;
  children: (data: T) => React.ReactNode;
}) {
  const retry = () => { void query.refetch(); };
  // A refetch of a failed query that never had data goes back to "pending" and clears `error`. Remember the last one.
  const lastError = React.useRef<Error | null>(null);
  if (query.error) lastError.current = query.error;
  if (query.data === undefined) {
    // Offline: TanStack pauses the fetch, so the query stays pending. Say so instead of showing a skeleton forever.
    if (query.fetchStatus === "paused") {
      return <ErrorState compact subject={subject} className={errorClassName} onRetry={retry} />;
    }
    // Keep the error up until data arrives, including while a background retry runs.
    if (query.isError || query.errorUpdatedAt > 0) {
      return <ErrorState compact subject={subject} className={errorClassName} error={query.error ?? lastError.current} onRetry={retry} />;
    }
  }
  if (query.isPending) {
    return (
      <div role="status" aria-label="Loading section" className="motion-safe:animate-pulse">
        {skeleton}
        <span className="sr-only">Loading information</span>
      </div>
    );
  }
  // Success, or an error that still has earlier data to show.
  return <>{children(query.data as T)}</>;
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}

const SECTION_LINK_CLASS =
  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md text-sm font-medium text-slate-900 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 md:min-h-0 applicant-touch:min-h-11";

const RECENT_DESCRIPTION = "Track progress from submission to job placement.";
const JOBS_DESCRIPTION = "Verified vacancies matching recruitment demands nationwide.";

function listSkeleton(rows: number, rowClass = "h-[193px] sm:h-[137px] lg:h-[85px]") {
  return (
    <div className="divide-y divide-slate-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${rowClass} p-5 space-y-2`}>
          <div className="h-4 w-1/3 bg-slate-200" />
          <div className="h-3 w-1/2 bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

const readinessSkeleton = (
  <div className="space-y-3">
    <div className="h-4 w-1/2 bg-slate-200" />
    <div className="h-3 w-3/4 bg-slate-100" />
    <div className="h-2 w-full bg-slate-100 rounded-full" />
    <div className="h-3 w-1/3 bg-slate-100" />
  </div>
);

const metricsSkeleton = (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="bg-white p-5 rounded-md border border-slate-200 h-[130px] sm:h-[118px] space-y-2">
        <div className="h-3 w-1/2 bg-slate-200" />
        <div className="h-8 w-12 bg-slate-200" />
        <div className="h-3 w-3/4 bg-slate-100" />
      </div>
    ))}
  </div>
);

function summarizeApplications(applicationData: unknown) {
  const data = applicationData as
    | any[]
    | { items?: any[]; total?: number }
    | undefined;
  const applications: any[] = Array.isArray(data) ? data : data?.items ?? [];
  const totalApps = Array.isArray(data) ? applications.length : data?.total ?? applications.length;
  const activeApps = applications.filter(
    (a) =>
      a.status !== ApplicationStatus.DEPLOYED &&
      a.status !== ApplicationStatus.ARCHIVED &&
      a.status !== ApplicationStatus.BACKOUT &&
      a.status !== ApplicationStatus.REJECTED &&
      a.status !== ApplicationStatus.TALENT_POOL
  ).length;
  const interviewApps = applications.filter(
    (a) =>
      a.status === ApplicationStatus.INITIAL_SCREENING ||
      a.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
      a.status === ApplicationStatus.FINAL_INTERVIEW
  ).length;
  const placedApps = applications.filter((a) => a.status === ApplicationStatus.DEPLOYED).length;
  return { applications, totalApps, activeApps, interviewApps, placedApps };
}

export const ApplicantDashboard: React.FC = () => {
  const streamConnected = useLiveStreamConnected();
  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    retry: 1,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: ({ signal }) => applicantJobsApi.getMyApplicationSummaries({ summary: true }, { signal }),
    refetchInterval: (query) => getApplicationRefetchInterval(query.state.data, streamConnected),
    refetchOnWindowFocus: true,
  });

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: ({ signal }) => applicantJobsApi.getMyInvitations({ signal }),
    refetchInterval: pollInterval(INVITATION_POLL_MS, streamConnected),
  });

  const jobsQuery = useQuery({
    queryKey: ["applicant", "open-jobs-preview"],
    queryFn: ({ signal }) => applicantJobsApi.getJobsPage({ page: 1, limit: 4 }, { signal }),
  });

  const profile = profileQuery.data || null;
  const openJobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : jobsQuery.data?.items ?? [];
  const openJobsTotal = Array.isArray(jobsQuery.data) ? jobsQuery.data.length : jobsQuery.data?.total ?? openJobs.length;

  const applicationTotal = applicationsQuery.data ? summarizeApplications(applicationsQuery.data).totalApps : undefined;

  const allInvitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
  const pendingInvitations = allInvitations.filter((inv) => inv.status === "PENDING");
  // Hold the body for at most 2 s so a slow invitations request cannot block the rest of the page.
  const [invitationsWaitOver, setInvitationsWaitOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setInvitationsWaitOver(true), 2000);
    return () => clearTimeout(timer);
  }, []);
  // Offline queries are paused, not pending: let the sections show their own connection message.
  const invitationsPending =
    invitationsQuery.isPending && invitationsQuery.fetchStatus !== "paused" && !invitationsWaitOver;

  return (
    <div className="space-y-6">
      <PageHeader
        title={getTimeBasedGreeting(profile?.firstName)}
        description="See where each application stands and discover verified job opportunities."
        breadcrumbs={[{ label: "Candidate Portal" }]}
        actions={
          <Button asChild variant="outline">
            <Link to="/app/jobs">Browse Jobs</Link>
          </Button>
        }
      />

      {/* Hold the page body until invitations are known: the banner then arrives with the content and nothing is pushed down. */}
      {invitationsPending ? (
        <div role="status" aria-label="Loading dashboard" className="space-y-6 motion-safe:animate-pulse">
          <div className="min-h-[244px] sm:min-h-[148px] rounded-md border border-slate-200 bg-white p-5">{readinessSkeleton}</div>
          {metricsSkeleton}
          <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
            <SectionHeader title="Recent Applications" description={RECENT_DESCRIPTION} />
            {listSkeleton(3)}
          </div>
          <span className="sr-only">Loading dashboard</span>
        </div>
      ) : (
        <>
        {/* Pending Job Invitations Alert Banner */}
        {pendingInvitations.length > 0 && (
          <div className="bg-slate-100 border border-slate-200 p-5 rounded-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-slate-900 shrink-0" />
                  <h2 className="text-base font-bold text-slate-900">
                    {pendingInvitations.length === 1
                      ? `You received an invitation for ${pendingInvitations[0].title}!`
                      : `You have ${pendingInvitations.length} pending job invitations!`}
                  </h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Talent Acquisition matched your qualifications to open positions. Review position details and submit your application with one click.
                </p>
              </div>
              <Button asChild className="shrink-0">
                <Link to="/app/applications" search={{ tab: "invitations" }}>
                  Review Invitations ({pendingInvitations.length})
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Digital Resume Readiness Card */}
        <div className="bg-white border border-slate-200 p-5 rounded-md min-h-[244px] sm:min-h-[148px]">
          <SectionData
            query={profileQuery}
            subject="your profile"
            errorClassName="border-0 bg-transparent p-0"
            skeleton={readinessSkeleton}
          >
            {(profileData) => {
              const profileHealth = computeProfileHealth(profileData || null);
              const readinessPercent = profileHealth.score;
              return (
                <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Digital Resume Readiness:
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                      {readinessPercent}%
                    </span>
                    <span className="inline-flex shrink-0 items-center whitespace-nowrap px-2 py-0.5 bg-slate-100 text-slate-900 border border-slate-200 text-xs font-medium rounded-md">
                      {profileHealth.tier}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Complete your profile to increase visibility to recruiters and partner employers.
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link to="/app/profile">
                    <span>{readinessPercent >= 100 ? "View Profile" : "Complete Profile"}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>

              <div className="w-full bg-slate-100 h-2 border border-slate-200 overflow-hidden rounded-full my-3">
                <div
                  className="h-full bg-slate-900 transition-all duration-300 rounded-full"
                  style={{ width: `${readinessPercent}%` }}
                  role="progressbar"
                  aria-label="Resume readiness"
                  aria-valuenow={readinessPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600">
                {readinessPercent >= 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                )}
                <span>{profileHealth.nextActionTip}</span>
              </div>
                </>
              );
            }}
          </SectionData>
        </div>

        {/* 4-Segment Operational Metrics Cards */}
        <SectionData
          query={applicationsQuery}
          subject="your application counts"
          skeleton={metricsSkeleton}
        >
          {(applicationData) => {
            const { totalApps, activeApps, interviewApps, placedApps } = summarizeApplications(applicationData);
            return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-md border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Applications
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tabular-nums">
                  {totalApps}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Total submissions
                </div>
              </div>
              <div className="bg-white p-5 rounded-md border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  In Progress
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 tabular-nums">
                  {activeApps}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Under recruiter evaluation
                </div>
              </div>
              <div className="bg-white p-5 rounded-md border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Interviews
                </div>
                <div className="text-2xl sm:text-3xl font-black text-navy mt-1 tabular-nums">
                  {interviewApps}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Screening & client sessions
                </div>
              </div>
              <div className="bg-white p-5 rounded-md border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Placed
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1 tabular-nums">
                  {placedApps}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Successfully deployed
                </div>
              </div>
            </div>
            );
          }}
        </SectionData>

        {/* Recent Applications Section */}
        <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
          <SectionHeader
            title="Recent Applications"
            description={RECENT_DESCRIPTION}
            action={
              // Hidden for an empty list: the empty state below already offers the next step.
              applicationTotal === 0 ? null : (
                <Link to="/app/applications" className={SECTION_LINK_CLASS}>
                  {applicationTotal === undefined ? "View All" : `View All (${applicationTotal})`}
                </Link>
              )
            }
          />

          <SectionData
            query={applicationsQuery}
            subject="your applications"
            errorClassName="m-4"
            skeleton={listSkeleton(3)}
          >
            {(applicationData) => {
              const { applications } = summarizeApplications(applicationData);
              return (
              applications.length === 0 ? (
                <EmptyState
                  bare
                  icon={<Briefcase className="w-6 h-6 text-slate-400" />}
                  title="No applications yet"
                  description="Browse current verified job requisitions and submit your application with one click."
                  action={
                    <Button asChild>
                      <Link to="/app/jobs">Browse Open Jobs</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="divide-y divide-slate-200">
                  {applications.slice(0, 5).map((app) => {
                    const clientName = (app.jobPosting as any)?.mrf?.client?.name || "Verified Client";
                    return (
                      <div
                        key={app.id}
                        className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">
                              {app.jobPosting?.title || "Job Opening"}
                            </span>
                            <StatusBadge status={app.status} audience="applicant" size="sm" />
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                            <span className="flex items-center gap-1 font-medium text-slate-900">
                              <Building className="w-3.5 h-3.5 text-slate-400" />
                              <span>{clientName}</span>
                            </span>
                            {app.jobPosting?.location && (
                              <span className="flex items-center gap-1 text-slate-500">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{app.jobPosting.location}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Applied {formatDate(app.createdAt)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Button asChild variant="outline" size="sm">
                            <Link to="/app/applications">
                              <span>Track Status</span>
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
              );
            }}
          </SectionData>
        </div>

        {/* Recommended Open Jobs Preview */}
        {(jobsQuery.isPending || jobsQuery.isError || openJobs.length > 0) && (
          <div className="bg-white rounded-md border border-slate-200 overflow-hidden">
            <SectionHeader
              title="Recommended Positions for You"
              description={JOBS_DESCRIPTION}
              action={
                <Link to="/app/jobs" className={SECTION_LINK_CLASS}>
                  {jobsQuery.data ? `Browse All (${openJobsTotal})` : "Browse All"}
                </Link>
              }
            />

            <SectionData query={jobsQuery} subject="open jobs" errorClassName="m-4" skeleton={listSkeleton(2, "h-[120px]")}>
              {() => (
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {openJobs.slice(0, 4).map((job) => {
                    const clientName = (job as any)?.mrf?.client?.name || "Verified Client";
                    return (
                      <div
                        key={job.id}
                        className="p-5 flex flex-col justify-between hover:bg-slate-50 transition-colors space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 hover:text-slate-700 transition-colors leading-snug">
                              {job.title}
                            </h3>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              Open
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium text-slate-900">{clientName}</span>
                            <span>{job.location || "Philippines"}</span>
                            {((job as any)?.mrf?.salaryRangeMin || (job as any)?.mrf?.salaryRangeMax) ? (
                              <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md text-xs border border-emerald-200">
                                {formatSalaryRange((job as any).mrf.salaryRangeMin, (job as any).mrf.salaryRangeMax)}
                              </span>
                            ) : null}
                          </div>

                          {job.description && (
                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                              {job.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            Posted {formatDate(job.createdAt)}
                          </span>
                          <Link
                            to="/app/jobs/$jobId"
                            params={{ jobId: String(job.id) }}
                            className={`${SECTION_LINK_CLASS} gap-1`}
                          >
                            <span>View Details</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionData>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default ApplicantDashboard;
