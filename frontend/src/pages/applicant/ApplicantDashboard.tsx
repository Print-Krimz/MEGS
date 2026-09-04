import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Search,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Button } from "../../components/ui";
import { computeProfileHealth } from "../../lib/profile-health";
import { ApplicationStatusStepper } from "../../components/applicant/ApplicationStatusStepper";
import { JobCard } from "../../components/applicant/JobCard";
import { InvitationCard } from "../../components/applicant/InvitationCard";
import { notify } from "../../lib/feedback";

export const ApplicantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchLocation, setSearchLocation] = useState("");

  const profileQuery = useQuery({
    queryKey: ["applicant", "profile"],
    queryFn: applicantApi.getProfile,
    retry: 1,
  });

  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const invitationsQuery = useQuery({
    queryKey: ["applicant", "invitations"],
    queryFn: applicantJobsApi.getMyInvitations,
    refetchInterval: 15000,
  });

  const jobsQuery = useQuery({
    queryKey: ["applicant", "open-jobs-preview"],
    queryFn: () => applicantJobsApi.getJobs({ limit: 4 }),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response }: { id: string | number; response: "ACCEPTED" | "DECLINED" }) =>
      applicantJobsApi.respondToInvitation(id, response),
    onSuccess: (_, variables) => {
      invitationsQuery.refetch();
      if (variables.response === "ACCEPTED") {
        applicationsQuery.refetch();
        notify.success("Invitation Accepted", "Your application has been created.");
      } else {
        notify.info("Invitation Declined", "Recruiters have been notified.");
      }
    },
    onError: (err) => {
      notify.error("Action Failed", err);
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/app/jobs",
      search: {
        search: searchKeyword.trim() || undefined,
        location: searchLocation.trim() || undefined,
      } as any,
    });
  };

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

  const profileHealth = computeProfileHealth(profile);
  const readinessPercent = profileHealth.score;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title={getTimeBasedGreeting(profile?.firstName)}
          description="See where each application stands and discover matching opportunities."
          breadcrumbs={[{ label: "My career" }]}
          actions={
            <div className="flex items-center gap-2">
              <Link to="/app/jobs">
                <Button variant="outline" size="sm" leftIcon={<Briefcase className="w-4 h-4" />}>
                  Explore Jobs
                </Button>
              </Link>
              {readinessPercent >= 85 && (
                <Link to="/app/profile">
                  <Button variant="primary" size="sm">
                    View Profile
                  </Button>
                </Link>
              )}
            </div>
          }
        />

        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search job title, skills, or keywords..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>
            <div className="sm:w-64 relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Location (e.g. Laguna, Manila)..."
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<Search className="w-4 h-4" />}
              className="shrink-0"
            >
              Search Jobs
            </Button>
          </form>
        </div>
      </div>

      {pendingInvitations.length > 0 && (
        <div className="bg-blue-50/70 border border-blue-200 p-4 sm:p-5 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {pendingInvitations.length === 1
                    ? `Direct Invitation: ${pendingInvitations[0].title}`
                    : `You have ${pendingInvitations.length} pending job invitations!`}
                </h3>
                <p className="text-xs text-slate-600">
                  A recruiter matched your candidate profile. Review details and respond.
                </p>
              </div>
            </div>
            <Link
              to="/app/applications"
              search={{ tab: "invitations" } as any}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
            >
              View All Invitations ({pendingInvitations.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingInvitations.slice(0, 2).map((inv) => (
              <InvitationCard
                key={inv.id}
                invitation={inv}
                onAccept={(target) => respondMutation.mutate({ id: target.id, response: "ACCEPTED" })}
                onDecline={(target) => respondMutation.mutate({ id: target.id, response: "DECLINED" })}
                loading={respondMutation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Applications
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {totalApps}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Total submissions
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            In Progress
          </div>
          <div className="text-2xl font-bold font-mono text-blue-900 mt-1 tabular-nums">
            {activeApps}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Under active review
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            Interviews
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-900 mt-1 tabular-nums">
            {interviewApps}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Scheduled / Endorsed
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
            Placed
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1 tabular-nums">
            {placedApps}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Hired & deployed
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Recent Applications
            </h3>
          </div>
          <Link
            to="/app/applications"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            View all ({applications.length}) →
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Briefcase className="w-6 h-6 text-slate-400" />}
              title="No applications yet"
              description="Explore current job openings and submit your first application."
              action={
                <Link to="/app/jobs">
                  <Button variant="primary" size="md">
                    Browse Jobs
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.slice(0, 3).map((app) => (
              <div
                key={app.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-base font-bold text-slate-900">
                        {app.jobPosting?.title || "Job opening"}
                      </span>
                      <StatusBadge status={app.status} audience="applicant" size="sm" />
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>Applied: {formatDate(app.createdAt)}</span>
                      {app.jobPosting?.location && <span>• {app.jobPosting.location}</span>}
                    </div>
                  </div>

                  <Link
                    to="/app/applications"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                  >
                    <span>View Application</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <ApplicationStatusStepper currentStatus={app.status} compact />
              </div>
            ))}
          </div>
        )}
      </div>

      {openJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-slate-900">
                Jobs you may like
              </h3>
            </div>
            <Link
              to="/app/jobs"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Explore all openings →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openJobs.slice(0, 4).map((job) => (
              <JobCard
                key={job.id}
                id={job.id}
                title={job.title}
                company={(job as any).client?.name || (job as any).company || "MAR Employment (MEGS)"}
                location={job.location || "Philippines"}
                workSetup={(job as any).workSetup || "ON_SITE"}
                salaryRange={(job as any).salaryRange}
                employmentType={(job as any).employmentType || "Full-time"}
                description={job.description}
                requirements={job.requirements}
                skills={(job as any).skills}
                createdAt={job.createdAt}
                status={(job as any).status}
                detailUrl={`/app/jobs/${job.id}`}
              />
            ))}
          </div>
        </div>
      )}

      {readinessPercent < 100 && (
        <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-xl shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Profile Readiness:
              </span>
              <span className="text-sm font-bold text-blue-600">
                {readinessPercent}%
              </span>
              <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700 rounded-md">
                {profileHealth.tier}
              </span>
            </div>
            <Link
              to="/app/profile"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
            >
              <span>Complete Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="w-full bg-slate-100 h-2 border border-slate-200 overflow-hidden rounded-full">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                readinessPercent >= 80 ? "bg-emerald-500" : "bg-blue-600"
              }`}
              style={{ width: `${readinessPercent}%` }}
              role="progressbar"
              aria-valuenow={readinessPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{profileHealth.nextActionTip}</span>
          </div>
        </div>
      )}
    </div>
  );
};
