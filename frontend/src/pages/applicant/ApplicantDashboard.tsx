import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { applicantApi } from "../../lib/api/applicant.api";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { formatDate, getTimeBasedGreeting } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import {
  Briefcase,
  AlertCircle,
  Mail,
  ArrowRight,
} from "lucide-react";
import { computeProfileHealth } from "../../lib/profile-health";

export const ApplicantDashboard: React.FC = () => {
  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    retry: 1,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: applicantJobsApi.getMyInvitations,
    refetchInterval: 10000,
  });

  const jobsQuery = useQuery({
    queryKey: ["applicant", "open-jobs-preview"],
    queryFn: () => applicantJobsApi.getJobs({ limit: 4 }),
  });

  if (profileQuery.isLoading || applicationsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Applicant Portal"
          description="Track your applications and recruitment milestones"
        />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (applicationsQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Applicant Portal"
          description="Track your applications and recruitment milestones"
        />
        <ErrorState
          error={applicationsQuery.error}
          onRetry={() => {
            profileQuery.refetch();
            applicationsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const profile = profileQuery.data || null;
  const applications = Array.isArray(applicationsQuery.data) ? applicationsQuery.data : [];
  const openJobs = Array.isArray(jobsQuery.data) ? jobsQuery.data : [];

  const allInvitations = Array.isArray(invitationsQuery.data) ? invitationsQuery.data : [];
  const pendingInvitations = allInvitations.filter((inv) => inv.status === "PENDING");

  // Metrics computation
  const totalApps = applications.length;
  const activeApps = applications.filter(
    (a) =>
      a.status !== ApplicationStatus.DEPLOYED &&
      a.status !== ApplicationStatus.ARCHIVED &&
      a.status !== ApplicationStatus.BACKOUT &&
      a.status !== ApplicationStatus.TALENT_POOL
  ).length;
  const interviewApps = applications.filter(
    (a) =>
      a.status === ApplicationStatus.INITIAL_SCREENING ||
      a.status === ApplicationStatus.CLIENT_ENDORSEMENT ||
      a.status === ApplicationStatus.FINAL_INTERVIEW
  ).length;
  const placedApps = applications.filter(
    (a) => a.status === ApplicationStatus.DEPLOYED
  ).length;

  // Profile readiness computed via unified profile health engine
  const profileHealth = computeProfileHealth(profile);
  const readinessPercent = profileHealth.score;

  return (
    <div className="space-y-5">
      <PageHeader
        title={getTimeBasedGreeting(profile?.firstName)}
        description="See where each application stands and what to do next."
        breadcrumbs={[{ label: "My career" }]}
        actions={
          <div className="flex gap-2">
            <Link to="/app/jobs" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
              Browse jobs
            </Link>
            {readinessPercent >= 85 && (
              <Link to="/app/profile" className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                Update profile
              </Link>
            )}
          </div>
        }
      />

      {/* Pending Job Invitations Alert Card */}
      {pendingInvitations.length > 0 && (
        <div className="bg-teal-50 border-l-4 border-teal-700 border border-teal-200 p-4 rounded-md shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-teal-800 shrink-0" />
                <h3 className="text-base font-semibold text-teal-950">
                  {pendingInvitations.length === 1
                    ? `You received a job invitation for ${pendingInvitations[0].title}!`
                    : `You have ${pendingInvitations.length} pending job invitations!`}
                </h3>
              </div>
              <p className="text-sm text-teal-800 leading-relaxed">
                Talent Acquisition matched your profile to open positions. Review details and submit your application with one click.
              </p>
            </div>
            <Link
              to="/app/applications"
              search={{ tab: "invitations" }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              Review Invitations ({pendingInvitations.length})
            </Link>
          </div>
        </div>
      )}

      {/* Streamlined Profile Readiness Progress Card */}
      {readinessPercent < 85 && (
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                Profile Strength:
              </span>
              <span className="text-xs font-bold font-sans text-teal-700">
                {readinessPercent}%
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold uppercase text-slate-700 rounded-xs">
                {profileHealth.tier}
              </span>
            </div>
            <Link
              to="/app/profile"
              className="inline-flex items-center gap-1 min-h-11 px-2.5 py-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-md transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
            >
              <span>Complete Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="w-full bg-slate-100 h-1.5 border border-slate-200 overflow-hidden rounded-full my-2.5">
            <div
              className="h-full bg-teal-600 transition-all duration-300 rounded-full"
              style={{ width: `${readinessPercent}%` }}
              role="progressbar"
              aria-valuenow={readinessPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{profileHealth.nextActionTip}</span>
          </div>
        </div>
      )}

      {/* Unified 4-Segment Operational Metrics Ribbon */}
      <div className="border border-slate-300 bg-slate-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-px">
        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-sm font-medium text-slate-600">
            Applications
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {totalApps}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            All applications
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-sm font-medium text-teal-800">
            In progress
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            {activeApps}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            Still being considered
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-sm font-medium text-blue-800">
            Interviews
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {interviewApps}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            Interview activity
          </div>
        </div>

        <div className="p-3 sm:p-3.5 bg-white">
          <div className="text-sm font-medium text-emerald-800">
            Placed
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {placedApps}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">
            Deployed
          </div>
        </div>
      </div>

      {/* Active Applications Section */}
      <div className="border border-slate-300 bg-white overflow-hidden">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Recent Applications
            </h3>
          </div>
          <Link to="/app/applications" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
            View all ({applications.length})
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Briefcase className="w-5 h-5" />}
            title="No applications yet"
            description="Explore current jobs and apply when you find a role that suits you."
            action={
                <Link to="/app/jobs" className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                  Browse jobs
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {applications.slice(0, 5).map((app) => (
              <div
                key={app.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-950">
                      {app.jobPosting?.title || "Job opening"}
                    </span>
                    <StatusBadge status={app.status} audience="applicant" size="sm" />
                  </div>
                  <div className="text-sm text-slate-500 flex flex-wrap items-center gap-3">
                    <span>Applied: {formatDate(app.createdAt)}</span>
                    {app.jobPosting?.location && <span>• {app.jobPosting.location}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to="/app/applications" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                    Track status
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Open Jobs Grid */}
      {openJobs.length > 0 && (
        <div className="border border-slate-300 bg-white">
          <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">
                Jobs you may like
              </h3>
            </div>
            <Link to="/app/jobs" className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-teal-800 hover:text-teal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700">
              Browse jobs
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
            {openJobs.slice(0, 4).map((job) => (
              <div
                key={job.id}
                className="p-4 flex flex-col justify-between hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-base font-semibold text-slate-950 hover:text-teal-800">
                      {job.title}
                    </h4>
                    <span className="text-xs font-medium px-2 py-1 rounded-full border border-slate-300 bg-slate-100 text-slate-700">
                      Open
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-normal">
                    {job.description}
                  </p>
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <span>{job.location || "Philippines"}</span>
                    <span>•</span>
                    <span>Posted {formatDate(job.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Review the role details</span>
                  <Link to="/app/jobs" className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                    View jobs
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
