import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { Briefcase, MapPin, ArrowRight } from "lucide-react";

export const JobsPage: React.FC = () => {
  const [searchValue, setSearchValue] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const jobsQuery = useQuery({
    queryKey: ["applicant", "jobs", searchValue, filterValues],
    queryFn: () =>
      applicantJobsApi.getJobs({
        search: searchValue || undefined,
        location: filterValues.location || undefined,
      }),
  });

  const jobs = jobsQuery.data || [];
  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const paginatedJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

  const handleSearchChange = (val: string) => {
    setSearchValue(val);
    setPage(1);
  };

  const handleFilterChange = (key: string, val: string) => {
    setFilterValues((prev) => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleReset = () => {
    setSearchValue("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Openings & Requisitions"
        description="Explore active recruitment opportunities and submit your candidacy"
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Job Board" },
        ]}
      />

      {/* Filter Bar */}
      <SearchFilters
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "location",
            label: "Location",
            options: [
              { value: "Valenzuela", label: "Valenzuela (Central HQ)" },
              { value: "Quezon City", label: "Quezon City" },
              { value: "Laguna", label: "Laguna" },
              { value: "Batangas", label: "Batangas" },
              { value: "Cavite", label: "Cavite" },
              { value: "Cebu", label: "Cebu" },
              { value: "Davao", label: "Davao" },
              { value: "Metro Manila", label: "Metro Manila" },
            ],
          },
        ]}
      />

      {/* Content */}
      {jobsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : jobsQuery.isError ? (
        <ErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : jobs.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Briefcase className="w-5 h-5" />}
            title="No matching job requisitions found"
            description="Try clearing search filters or check back later as new positions are posted daily."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-slate-300 p-4 flex flex-col justify-between hover:border-teal-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-bold font-mono uppercase text-slate-950 leading-snug">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{job.location || "Philippines"}</span>
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-300">
                      {job.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-normal font-sans">
                    {job.description}
                  </p>

                  {job.requirements && (
                    <div className="pt-1">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        Requirements:
                      </span>
                      <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-sans">
                        {job.requirements}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs font-mono">
                    <span className="font-bold text-slate-800 uppercase">
                      REQ #{job.id}
                    </span>
                    <div className="text-[10px] text-slate-400">
                      Posted {formatDate(job.createdAt)}
                    </div>
                  </div>

                  <Link
                    to="/app/jobs/$jobId"
                    params={{ jobId: String(job.id) }}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-slate-300 p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={jobs.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
