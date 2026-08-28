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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export const ApplicantDashboard: React.FC = () => {
  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    retry: 1,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
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
  const applications = applicationsQuery.data || [];
  const openJobs = jobsQuery.data || [];

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

  // Profile readiness checklist
  const hasPersonalInfo = Boolean(profile?.firstName && profile?.lastName && profile?.mobileNumber);
  const hasResume = Boolean(profile?.resumeUrl);
  const hasPhoto = Boolean(profile?.photoUrl);
  const readinessCount = [hasPersonalInfo, hasResume, hasPhoto].filter(Boolean).length;
  const readinessPercent = Math.round((readinessCount / 3) * 100);

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
            {readinessPercent === 100 && (
              <Link to="/app/profile" className="inline-flex min-h-11 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                Update profile
              </Link>
            )}
          </div>
        }
      />

      {/* Profile Readiness Banner */}
      {readinessPercent < 100 && (
        <div className="bg-amber-50 border-l-4 border-amber-600 border border-slate-300 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <h3 className="text-base font-semibold text-amber-950">
                  Complete your profile ({readinessPercent}%)
                </h3>
              </div>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Add the missing details so recruiters have the information they need when reviewing your applications.
                </p>
            </div>
            <Link to="/app/profile" className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-teal-800 bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
              Complete profile
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-amber-200 text-xs">
            <div className="flex items-center gap-2">
              {hasPersonalInfo ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <div className="w-3.5 h-3.5 border border-slate-400" />
              )}
              <span className={hasPersonalInfo ? "text-slate-900 font-medium" : "text-slate-500"}>
                Personal Info
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasResume ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <div className="w-3.5 h-3.5 border border-slate-400" />
              )}
              <span className={hasResume ? "text-slate-900 font-medium" : "text-slate-500"}>
                Resume Uploaded
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasPhoto ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              ) : (
                <div className="w-3.5 h-3.5 border border-slate-400" />
              )}
              <span className={hasPhoto ? "text-slate-900 font-medium" : "text-slate-500"}>
                Photo Attached
              </span>
            </div>
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
            Work placement
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
