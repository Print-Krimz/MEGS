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
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { ApplicationStatus } from "../../lib/types/enums";
import {
  Briefcase,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
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
      a.status !== ApplicationStatus.HIRED &&
      a.status !== ApplicationStatus.DEPLOYED &&
      a.status !== ApplicationStatus.ARCHIVED &&
      a.status !== ApplicationStatus.BACKOUT
  ).length;
  const interviewApps = applications.filter(
    (a) =>
      a.status === ApplicationStatus.INITIAL_SCREENING ||
      a.status === ApplicationStatus.FINAL_INTERVIEW
  ).length;
  const hiredApps = applications.filter(
    (a) =>
      a.status === ApplicationStatus.HIRED ||
      a.status === ApplicationStatus.DEPLOYED
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
        title={`Welcome back, ${profile?.firstName || "Candidate"}`}
        description="Monitor application progress, interview schedules, and job matches"
        breadcrumbs={[{ label: "Applicant Portal" }]}
        actions={
          <div className="flex gap-2">
            <Link to="/app/jobs">
              <Button variant="outline" size="sm" leftIcon={<Briefcase className="w-3.5 h-3.5" />}>
                Browse Jobs
              </Button>
            </Link>
            <Link to="/app/profile">
              <Button variant="primary" size="sm" leftIcon={<UserCheck className="w-3.5 h-3.5" />}>
                Update Profile
              </Button>
            </Link>
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
                <h3 className="text-xs font-mono font-bold text-amber-950 uppercase tracking-wider">
                  Profile Completeness ({readinessPercent}%)
                </h3>
              </div>
                <p className="text-xs text-amber-800 leading-relaxed font-sans">
                  Complete your profile and upload your resume to improve your job match results and interview eligibility.
                </p>
            </div>
            <Link to="/app/profile" className="shrink-0">
              <Button variant="primary" size="sm">
                Complete Profile
              </Button>
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
      <div className="border border-slate-300 bg-white grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Total Submissions
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {totalApps}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <FileText className="w-3 h-3 text-slate-400" />
            <span>Lifetime applications</span>
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Active in Pipeline
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            {activeApps}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Clock className="w-3 h-3 text-teal-700" />
            <span>Under review / processing</span>
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Interview Stage
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {interviewApps}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <Clock className="w-3 h-3 text-blue-700" />
            <span>Initial / Final interviews</span>
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Hired / Deployed
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {hiredApps}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>Successful placements</span>
          </div>
        </div>
      </div>

      {/* Active Applications Section */}
      <div className="border border-slate-300 bg-white overflow-hidden">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-slate-700" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Recent Applications
            </h3>
          </div>
          <Link to="/app/applications">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              View All ({applications.length})
            </Button>
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Briefcase className="w-5 h-5" />}
              title="No active applications"
              description="Explore open manpower requisitions and apply directly with your candidate profile."
              action={
                <Link to="/app/jobs">
                  <Button variant="primary" size="sm">
                    Browse Open Jobs
                  </Button>
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
                    <span className="text-xs font-bold text-slate-950 font-mono uppercase">
                      {app.jobPosting?.title || "Job Requisition"}
                    </span>
                    <StatusBadge status={app.status} size="sm" />
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 font-mono">
                    <span>Applied: {formatDate(app.createdAt)}</span>
                    {app.jobPosting?.location && <span>• {app.jobPosting.location}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link to="/app/applications">
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                      Track Status
                    </Button>
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
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Featured Job Requisitions
              </h3>
            </div>
            <Link to="/app/jobs">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                Job Board →
              </Button>
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
                    <h4 className="text-xs font-bold font-mono uppercase text-slate-950 hover:text-teal-800">
                      {job.title}
                    </h4>
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border border-slate-300 bg-slate-100 text-slate-700">
                      Open
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-normal">
                    {job.description}
                  </p>
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                    <span>{job.location || "Philippines"}</span>
                    <span>•</span>
                    <span>Posted {formatDate(job.createdAt)}</span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-teal-800 font-mono">
                    Competitive Compensation
                  </span>
                  <Link to="/app/jobs">
                    <Button variant="outline" size="sm">
                      Apply
                    </Button>
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
