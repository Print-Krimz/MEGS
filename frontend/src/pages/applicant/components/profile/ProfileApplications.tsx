import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { applicantJobsApi } from "../../../../lib/api/applicant-jobs.api";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "../../../../components/common";
import { formatDate } from "../../../../lib/utils";
import type { Application } from "../../../../lib/types/application.types";

export const ProfileApplications: React.FC = () => {
  const applicationsQuery = useQuery({
    queryKey: ["applicant", "my-applications"],
    queryFn: applicantJobsApi.getMyApplications,
  });

  return (
    <section aria-labelledby="profile-applications-heading" className="space-y-5">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="profile-applications-heading" className="text-lg font-semibold text-slate-950">Applications</h2>
          <p className="text-sm text-slate-600">Review your recent applications and current progress.</p>
        </div>
        <Link
          to="/app/applications"
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0F294A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2"
        >
          View all applications
        </Link>
      </div>

      {applicationsQuery.isLoading ? (
        <LoadingState variant="table" rows={3} message="Loading applications…" />
      ) : applicationsQuery.isError ? (
        <ErrorState
          message="We couldn't load your applications. Try again."
          onRetry={() => void applicationsQuery.refetch()}
        />
      ) : applicationsQuery.data && applicationsQuery.data.length > 0 ? (
        <ul role="list" className="divide-y divide-slate-200 border-y border-slate-200">
          {applicationsQuery.data.slice(0, 5).map((application: Application) => {
            const jobTitle = application.jobPosting?.title || `Application #${application.id}`;
            return (
              <li key={application.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{jobTitle}</h3>
                  <p className="mt-1 text-xs text-slate-500">Applied {formatDate(application.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <StatusBadge status={application.status} audience="applicant" size="sm" />
                  <Link
                    to="/app/applications/$applicationId"
                    params={{ applicationId: String(application.id) }}
                    aria-label={`View application details for ${jobTitle}`}
                    className="inline-flex min-h-[44px] items-center text-sm font-semibold text-[#0F294A] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2"
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
              className="inline-flex min-h-[44px] items-center rounded-md bg-[#0F294A] px-4 text-sm font-semibold text-white hover:bg-[#163B66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F294A] focus-visible:ring-offset-2 transition-colors"
            >
              Explore jobs
            </Link>
          )}
        />
      )}
    </section>
  );
};
