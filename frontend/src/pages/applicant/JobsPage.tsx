import React, { useState, useEffect } from "react";
import { Link, useSearch } from "@tanstack/react-router";
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
import {
  formatDate,
  formatSalaryRange,
  formatEmploymentType,
  formatWorkArrangement,
} from "../../lib/utils";
import { Briefcase, MapPin, ArrowRight, Bookmark } from "lucide-react";
import { notify } from "../../lib/feedback";

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const routeSearch = useSearch({ strict: false }) as { q?: string; location?: string };
  const [scope, setScope] = useState<"all" | "saved">("all");
  const [searchValue, setSearchValue] = useState(routeSearch.q ?? "");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(
    routeSearch.location ? { location: routeSearch.location } : {},
  );
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Pick up search filters carried over from the landing page (e.g. /app/jobs?q=forklift).
  useEffect(() => {
    if (routeSearch.q !== undefined) setSearchValue(routeSearch.q);
    if (routeSearch.location !== undefined) {
      setFilterValues((prev) => ({ ...prev, location: routeSearch.location as string }));
    }
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSearch.q, routeSearch.location]);

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

  const deploymentQuery = useQuery({
    queryKey: ["applicant", "active-deployment"],
    queryFn: applicantJobsApi.getActiveDeployment,
  });

  const isDeployed = Boolean(deploymentQuery.data?.isCurrentlyDeployed);

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
          <div className="flex items-center border border-[#D9E2EC] bg-[#F7F9FC] p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-2 font-medium min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${
                scope === "all"
                  ? "bg-[#0B315D] text-white"
                  : "text-[#627D98] hover:text-[#102A43] hover:bg-[#EAF0F7]"
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
              className={`px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-2 font-medium min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${
                scope === "saved"
                  ? "bg-[#0B315D] text-white"
                  : "text-[#627D98] hover:text-[#102A43] hover:bg-[#EAF0F7]"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Saved Jobs ({savedJobIds.size})</span>
            </button>
          </div>
        }
      />

      {isDeployed && (
        <div className="rounded-lg border border-[#BCCCDC] bg-[#F0F4F8] p-4 text-[#102A43] shadow-xs">
          <p className="text-xs text-[#486581]">
            <strong className="text-[#102A43]">Notice:</strong> You are currently on an active assignment{deploymentQuery.data?.clientName ? ` with ${deploymentQuery.data.clientName}` : ""}. You can browse and bookmark positions for your records, but applications remain locked until your contract reaches redeployment.
          </p>
        </div>
      )}

      {/* Filter Bar */}
      <SearchFilters
        searchLabel="Search jobs"
        searchPlaceholder="Search by job title, skill, or keyword (e.g. Backend, React, Electrician)..."
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
        <div className="bg-white border border-[#D9E2EC] p-8 rounded-lg shadow-xs">
          {scope === "saved" ? (
            <EmptyState
              icon={<Bookmark className="w-6 h-6 text-[#0B315D]" />}
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
              icon={<Briefcase className="w-5 h-5 text-[#627D98]" />}
              title="No matching jobs found"
              description="Try clearing search filters or check back later as new positions are posted regularly."
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {paginatedJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white border border-[#D9E2EC] p-5 flex flex-col justify-between h-full rounded-lg hover:border-[#0B315D]/40 transition-colors"
              >
                <div className="flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        {job.imageUrl && (
                          <div className="mb-2">
                            <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />
                          </div>
                        )}
                        <h3 className="text-base font-semibold text-[#102A43] leading-snug">
                          {job.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#627D98]">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#627D98] shrink-0" />
                            <span>{job.location || "Philippines"}</span>
                          </span>
                          {job.mrf?.salaryRangeMin || job.mrf?.salaryRangeMax ? (
                            <span className="font-mono font-medium text-[#047857] bg-[#ECFDF5] px-2 py-0.5 rounded text-xs border border-[#A7F3D0]">
                              {formatSalaryRange(job.mrf.salaryRangeMin, job.mrf.salaryRangeMax)}
                            </span>
                          ) : null}
                          {job.mrf?.employmentType && (
                            <span className="text-[#102A43] bg-[#F7F9FC] px-2 py-0.5 rounded text-xs border border-[#D9E2EC]">
                              {formatEmploymentType(job.mrf.employmentType)}
                            </span>
                          )}
                          {job.mrf?.workArrangement && (
                            <span className="text-[#102A43] bg-[#F7F9FC] px-2 py-0.5 rounded text-xs border border-[#D9E2EC]">
                              {formatWorkArrangement(job.mrf.workArrangement)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-label={savedJobIds.has(job.id) ? "Remove from saved jobs" : "Save job for later"}
                          onClick={() => toggleBookmark(job.id)}
                          className={`p-2 rounded-md border transition-colors min-h-9 min-w-9 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-1 ${
                            savedJobIds.has(job.id)
                              ? "bg-[#EAF0F7] border-[#0B315D]/40 text-[#0B315D] hover:bg-[#D9E2EC]"
                              : "bg-white border-[#D9E2EC] text-[#627D98] hover:text-[#0B315D] hover:bg-[#EAF0F7]"
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${savedJobIds.has(job.id) ? "fill-[#0B315D] text-[#0B315D]" : ""}`} />
                        </button>
                        <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                          {job.status}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2.5 text-sm text-[#627D98] line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  </div>

                  {job.requirements && (
                    <div className="pt-1 text-xs text-[#627D98] line-clamp-1">
                      <span className="font-medium text-[#102A43]">Requirements: </span>
                      <span>{job.requirements}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#D9E2EC] flex items-center justify-between">
                  <div className="text-xs text-[#627D98]">
                    <span>Posted {formatDate(job.createdAt)}</span>
                  </div>

                  <Link
                    to="/app/jobs/$jobId"
                    params={{ jobId: String(job.id) }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#0B315D] bg-[#0B315D] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="bg-white border border-[#D9E2EC] p-2 rounded-lg shadow-xs">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={displayedJobs.length}
              pageSize={pageSize}
              onPageChange={setPage}
              itemLabel="jobs"
            />
          </div>
        </div>
      )}
    </div>
  );
};
