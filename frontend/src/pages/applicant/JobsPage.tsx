import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  JobImage,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { Briefcase, MapPin, ArrowRight, Bookmark } from "lucide-react";
import { notify } from "../../lib/feedback";

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"all" | "saved">("all");
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

  const savedJobIdsQuery = useQuery({
    queryKey: ["applicant", "saved-jobs", "ids"],
    queryFn: applicantJobsApi.getSavedJobIds,
  });

  const savedJobIds = new Set(savedJobIdsQuery.data || []);

  const saveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.saveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Saved", "Position added to your saved jobs.");
    },
    onError: (err: any) => notify.error("Save Failed", err),
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Removed", "Position removed from your saved jobs.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });

  const toggleBookmark = (jobId: number) => {
    if (savedJobIds.has(jobId)) {
      unsaveMutation.mutate(jobId);
    } else {
      saveMutation.mutate(jobId);
    }
  };

  const rawJobs = jobsQuery.data || [];
  const displayedJobs = scope === "saved"
    ? rawJobs.filter((job) => savedJobIds.has(job.id))
    : rawJobs;

  const totalPages = Math.max(1, Math.ceil(displayedJobs.length / pageSize));
  const paginatedJobs = displayedJobs.slice((page - 1) * pageSize, page * pageSize);

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
        title={scope === "all" ? "Explore jobs" : "Saved jobs"}
        description={
          scope === "all"
            ? "Browse current opportunities and apply when a role suits you."
            : "Review bookmarked job openings and continue your applications."
        }
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: scope === "all" ? "Explore jobs" : "Saved Jobs" },
        ]}
        actions={
          <div className="flex items-center border border-slate-300 bg-slate-100 p-0.5 rounded text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                scope === "all"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>All Openings ({rawJobs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("saved");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 ${
                scope === "saved"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Jobs ({savedJobIds.size})</span>
            </button>
          </div>
        }
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
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white border border-slate-300 p-8 rounded-lg shadow-xs">
          {scope === "saved" ? (
            <EmptyState
              icon={<Bookmark className="w-6 h-6 text-teal-700" />}
              title="No saved jobs yet"
              description="Bookmark job openings while exploring careers so you can review and apply when ready."
              action={
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setScope("all")}
                >
                  Explore all openings
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Briefcase className="w-5 h-5" />}
              title="No matching jobs found"
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
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-slate-300 p-5 flex flex-col justify-between hover:border-slate-400 transition-colors space-y-4 rounded-lg shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      {job.imageUrl && (
                        <div className="mb-2">
                          <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />
                        </div>
                      )}
                      <h3 className="text-base font-semibold text-slate-950 leading-snug">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{job.location || "Philippines"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={savedJobIds.has(job.id) ? "Remove from saved jobs" : "Save job for later"}
                        onClick={() => toggleBookmark(job.id)}
                        className={`p-1.5 rounded-md border transition-colors ${
                          savedJobIds.has(job.id)
                            ? "bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100"
                            : "bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 ${savedJobIds.has(job.id) ? "fill-teal-700 text-teal-700" : ""}`} />
                      </button>
                      <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  {job.requirements && (
                    <div className="text-xs text-slate-500 line-clamp-1">
                      <span className="font-medium text-slate-700">Requirements: </span>
                      <span>{job.requirements}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div className="font-medium text-slate-700">
                      REQ #{job.id}
                    </div>
                    <div>Posted {formatDate(job.createdAt)}</div>
                  </div>

                  <Link
                    to="/app/jobs/$jobId"
                    params={{ jobId: String(job.id) }}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-teal-800 bg-teal-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
              totalItems={displayedJobs.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
};
