import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { formatDate, formatSalaryRange } from "../../lib/utils";
import { Briefcase, MapPin, Building, Calendar, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";

export interface LandingJobListingsProps {
  searchQuery: string;
  locationQuery: string;
  onClearSearch: () => void;
}

export const LandingJobListings: React.FC<LandingJobListingsProps> = ({
  searchQuery,
  locationQuery,
  onClearSearch,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const jobsQuery = useQuery({
    queryKey: ["public-open-jobs", searchQuery, locationQuery],
    queryFn: () =>
      applicantJobsApi.getJobs({
        search: searchQuery || undefined,
        location: locationQuery || undefined,
      }),
  });

  const jobs = jobsQuery.data || [];
  const hasActiveFilter = Boolean(searchQuery || locationQuery);

  const handleApplyClick = (jobId: number) => {
    if (isAuthenticated && user?.role === Role.APPLICANT) {
      navigate({ to: `/app/jobs/${jobId}` });
    } else {
      const target = `/app/jobs/${jobId}`;
      navigate({
        to: "/login",
        search: { redirect: target },
      });
    }
  };

  return (
    <section id="jobs" className="py-14 sm:py-20 bg-slate-50 border-b border-slate-200 scroll-mt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0f294a]">
              Active Opportunities
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              Latest Job Openings
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Direct openings currently accepting applications through our recruitment network.
            </p>
          </div>

          {hasActiveFilter && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">
                Filtered results {jobs.length > 0 && `(${jobs.length} found)`}
              </span>
              <button
                type="button"
                onClick={onClearSearch}
                className="text-xs font-semibold text-[#0f294a] hover:underline cursor-pointer py-1 px-2 rounded-md hover:bg-slate-200/60"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        {/* 4-State UI */}
        {jobsQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 animate-pulse"
              >
                <div className="h-5 bg-slate-200 rounded-md w-3/4" />
                <div className="h-4 bg-slate-100 rounded-md w-1/2" />
                <div className="space-y-2 pt-2">
                  <div className="h-3 bg-slate-100 rounded w-full" />
                  <div className="h-3 bg-slate-100 rounded w-5/6" />
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="h-4 bg-slate-100 rounded w-1/4" />
                  <div className="h-8 bg-slate-200 rounded-lg w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {jobsQuery.isError && (
          <div className="mt-8 p-8 bg-white border border-rose-200 rounded-xl text-center max-w-md mx-auto space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Unable to load job listings</h3>
            <p className="text-xs text-slate-600">
              Could not connect to the recruitment database. Please try again.
            </p>
            <button
              type="button"
              onClick={() => jobsQuery.refetch()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0f294a] hover:bg-[#163b66] rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 && (
          <div className="mt-8 p-10 bg-white border border-slate-200 rounded-xl text-center max-w-lg mx-auto space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">No matching jobs found</h3>
              <p className="text-xs text-slate-500">
                {hasActiveFilter
                  ? `No open vacancies match "${searchQuery || locationQuery}". Try checking for spelling or searching broader terms.`
                  : "There are currently no active job requisitions published. Please check back soon."}
              </p>
            </div>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={onClearSearch}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0f294a] hover:bg-[#163b66] rounded-lg cursor-pointer"
              >
                Reset Search Filter
              </button>
            )}
          </div>
        )}

        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
            {jobs.map((job) => {
              const clientName = (job as any).mrf?.client?.name || "Verified Client";
              const industry = (job as any).mrf?.client?.industry;
              const employmentType = (job as any).mrf?.employmentType;

              return (
                <article
                  key={job.id}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 p-5 shadow-2xs flex flex-col justify-between transition-colors group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0f294a] transition-colors leading-snug">
                        {job.title}
                      </h3>
                      {employmentType && (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {employmentType.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{clientName}</span>
                        {industry && (
                          <span className="text-slate-400 font-normal">• {industry}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{job.location || "Philippines"}</span>
                      </div>

                      {((job as any).mrf?.salaryRangeMin || (job as any).mrf?.salaryRangeMax) ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0f294a] bg-blue-50/80 px-2 py-0.5 rounded border border-blue-200/80 w-fit">
                          <span>{formatSalaryRange((job as any).mrf.salaryRangeMin, (job as any).mrf.salaryRangeMax)}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>Posted {formatDate(job.createdAt)}</span>
                      </div>
                    </div>

                    {job.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 pt-1 leading-relaxed">
                        {job.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500">
                      {isAuthenticated ? "1-Click Apply" : "Sign in to apply"}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleApplyClick(job.id)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-white bg-[#0f294a] hover:bg-[#163b66] py-2 px-3.5 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a]"
                    >
                      <span>Apply</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
