import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { applicantJobsApi } from "../../../../lib/api/applicant-jobs.api";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "../../../../components/common";
import { formatDate } from "../../../../lib/utils";
import type { ApplicantApplicationSummary } from "../../../../lib/types/application.types";

export const ProfileApplications: React.FC = () => {
  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: ({ signal }) => applicantJobsApi.getMyApplicationSummaries({ summary: true }, { signal }),
  });
  const applicationData = applicationsQuery.data;
  const applications = Array.isArray(applicationData) ? applicationData : applicationData?.items ?? [];

  return (
    <section aria-labelledby="profile-applications-heading" className="space-y-5">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="profile-applications-heading" className="text-lg font-semibold text-[#102A43]">Applications</h2>
          <p className="text-sm text-[#486581]">Review your recent applications and current progress.</p>
        </div>
        <Link
          to="/app/applications"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0B315D] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2"
        >
          View all applications
        </Link>
      </div>

      {applicationsQuery.fetchStatus === "paused" && applicationData === undefined ? (
        <ErrorState compact subject="your applications" onRetry={() => void applicationsQuery.refetch()} />
      ) : applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={3} message="Loading applications…" />
      ) : applicationsQuery.isError ? (
        <ErrorState
          message="We couldn't load your applications. Try again."
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : applications.length > 0 ? (
        <ul role="list" className="divide-y divide-slate-200 border-y border-slate-200">
          {applications.slice(0, 5).map((application: ApplicantApplicationSummary) => {
            const jobTitle = application.jobPosting?.title || "Job application";
            return (
              <li key={application.id} className="min-w-0 flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between [overflow-wrap:anywhere]">
                <div className="min-w-0">
                  <h3 className="min-w-0 text-sm font-semibold text-[#0B315D]">
                    <Link
                      to="/app/applications/$applicationId"
                      params={{ applicationId: String(application.id) }}
                      className="inline-flex min-h-11 items-center rounded-sm text-[#0B315D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 md:min-h-0 applicant-touch:min-h-11 break-words"
                    >
                      {jobTitle}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-xs text-[#486581]">Applied {formatDate(application.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <StatusBadge status={application.status} audience="applicant" size="sm" />
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(application.id) }}
                    aria-label={`View application details for ${jobTitle}`}
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-[#0B315D] underline-offset-4 hover:text-[#082747] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 md:min-h-9 applicant-touch:min-h-11"
                  >
                    View details
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title="No applications yet"
          description="When you apply for a job, your application status will appear here."
          action={(
            <Link
              to="/app/jobs"
              className="inline-flex min-h-[44px] items-center rounded-md bg-[#0B315D] px-4 text-sm font-semibold text-white hover:bg-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors"
            >
              Browse jobs
            </Link>
          )}
        />
      )}
    </section>
  );
};
