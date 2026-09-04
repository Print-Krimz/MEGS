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
  CheckCircle2,
  Building,
  MapPin,
  Calendar,
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
          title="Candidate Portal"
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
          title="Candidate Portal"
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
    <div className="space-y-6">
      <PageHeader
        title={getTimeBasedGreeting(profile?.firstName)}
        description="See where each application stands and discover verified job opportunities."
        breadcrumbs={[{ label: "Candidate Portal" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/app/jobs"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:text-[#0f294a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
            >
              Browse Jobs
            </Link>
            <Link
              to="/app/profile"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#0f294a] bg-[#0f294a] px-4 text-xs sm:text-sm font-semibold text-white hover:bg-[#163b66] transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
            >
              Update Profile
            </Link>
          </div>
        }
      />

      {/* Pending Job Invitations Alert Banner (Bossjob style direct engagement) */}
      {pendingInvitations.length > 0 && (
        <div className="bg-[#e8eef6] border border-[#cbd5e1] p-5 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#0f294a] shrink-0" />
                <h3 className="text-base font-bold text-[#0f294a]">
                  {pendingInvitations.length === 1
                    ? `You received an invitation for ${pendingInvitations[0].title}!`
                    : `You have ${pendingInvitations.length} pending job invitations!`}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                Talent Acquisition matched your qualifications to open positions. Review position details and submit your application with one click.
              </p>
            </div>
            <Link
              to="/app/applications"
              search={{ tab: "invitations" }}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[#0f294a] hover:bg-[#163b66] px-4 text-xs sm:text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
            >
              Review Invitations ({pendingInvitations.length})
            </Link>
          </div>
        </div>
      )}

      {/* Digital Resume Readiness Card (Bossjob & Kalibrr inspired) */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Digital Resume Readiness:
              </span>
              <span className="text-sm font-black font-mono text-[#0f294a]">
                {readinessPercent}%
              </span>
              <span className="inline-flex items-center px-2 py-0.5 bg-[#e8eef6] text-[#0f294a] border border-[#cbd5e1] text-[10px] font-mono font-bold uppercase rounded">
                {profileHealth.tier}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Complete your profile to increase visibility to recruiters and partner employers.
            </p>
          </div>
          <Link
            to="/app/profile"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#0f294a] hover:text-[#163b66] hover:bg-slate-100 rounded-lg transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
          >
            <span>{readinessPercent >= 100 ? "View Profile" : "Complete Profile"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="w-full bg-slate-100 h-2 border border-slate-200 overflow-hidden rounded-full my-3">
          <div
            className="h-full bg-[#0f294a] transition-all duration-300 rounded-full"
            style={{ width: `${readinessPercent}%` }}
            role="progressbar"
            aria-valuenow={readinessPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          {readinessPercent >= 100 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{profileHealth.nextActionTip}</span>
        </div>
      </div>

      {/* 4-Segment Operational Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Applications
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-slate-900 mt-1 tabular-nums">
            {totalApps}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Total submissions
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-[#0f294a]">
            In Progress
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-[#0f294a] mt-1 tabular-nums">
            {activeApps}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Under recruiter evaluation
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            Interviews
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-900 mt-1 tabular-nums">
            {interviewApps}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Screening & client sessions
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Placed
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-800 mt-1 tabular-nums">
            {placedApps}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Successfully deployed
          </div>
        </div>
      </div>

      {/* Recent Applications Section (JobStreet Linear Milestone Tracking) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Recent Applications
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track progress from submission to job placement.
            </p>
          </div>
          <Link
            to="/app/applications"
            className="text-xs font-bold text-[#0f294a] hover:text-[#163b66] hover:underline"
          >
            View All ({applications.length})
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Briefcase className="w-6 h-6 text-slate-400" />}
              title="No applications yet"
              description="Explore current verified job requisitions and submit your application with one click."
              action={
                <Link
                  to="/app/jobs"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0f294a] hover:bg-[#163b66] px-4 text-xs font-bold text-white transition-colors"
                >
                  Browse Open Jobs
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.slice(0, 5).map((app) => {
              const clientName = (app.jobPosting as any)?.mrf?.client?.name || "Verified Client";
              return (
                <div
                  key={app.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {app.jobPosting?.title || "Job Opening"}
                      </span>
                      <StatusBadge status={app.status} audience="applicant" size="sm" />
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>{clientName}</span>
                      </span>
                      {app.jobPosting?.location && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{app.jobPosting.location}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Applied {formatDate(app.createdAt)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      to="/app/applications"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 hover:text-[#0f294a] px-3.5 text-xs font-bold text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
                    >
                      <span>Track Status</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended Open Jobs Preview */}
      {openJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Recommended Positions for You
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified vacancies matching recruitment demands nationwide.
              </p>
            </div>
            <Link
              to="/app/jobs"
              className="text-xs font-bold text-[#0f294a] hover:text-[#163b66] hover:underline"
            >
              Browse All ({openJobs.length})
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {openJobs.slice(0, 4).map((job) => {
              const clientName = (job as any)?.mrf?.client?.name || "Verified Client";
              return (
                <div
                  key={job.id}
                  className="p-5 flex flex-col justify-between hover:bg-slate-50/70 transition-colors space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 hover:text-[#0f294a] transition-colors leading-snug">
                        {job.title}
                      </h4>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                        Open
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{clientName}</span>
                      <span className="text-slate-300">•</span>
                      <span>{job.location || "Philippines"}</span>
                    </div>

                    {job.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {job.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Posted {formatDate(job.createdAt)}
                    </span>
                    <Link
                      to="/app/jobs/$jobId"
                      params={{ jobId: String(job.id) }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0f294a] hover:underline"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicantDashboard;
