import React, { useState, useEffect } from "react";
import { useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi, type JobPosting } from "../../lib/api/applicant-jobs.api";
import type { PaginatedListResponse } from "../../lib/types/api.types";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  ConfirmDialog,
} from "../../components/common";
import { Button } from "../../components/ui";
import { cn } from "../../lib/utils";
import { Briefcase, Bookmark, SearchX, Trash2 } from "lucide-react";
import { JobCard } from "./components/JobCard";
import { JobFilters, type JobFilterValues } from "./components/JobFilters";
import { jobLocationLabel } from "../../lib/job-locations";
import { MAX_SAVED_JOBS } from "../../lib/saved-jobs";
import { notify } from "../../lib/feedback";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";

export const JobsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const routeSearch = useSearch({ strict: false }) as { q?: string; location?: string };
  const [scope, setScope] = useState<"all" | "saved">("all");
  const [filters, setFilters] = useState<JobFilterValues>({
    search: routeSearch.q ?? "",
    location: routeSearch.location ?? "",
    salaryMin: "",
    salaryMax: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const debouncedSearch = normalizeServerSearch(useDebouncedValue(filters.search, SERVER_SEARCH_DEBOUNCE_MS));
  const debouncedSalaryMin = useDebouncedValue(filters.salaryMin, SERVER_SEARCH_DEBOUNCE_MS);
  const debouncedSalaryMax = useDebouncedValue(filters.salaryMax, SERVER_SEARCH_DEBOUNCE_MS);
  const locationFilter = filters.location.trim();

  const toPesos = (raw: string): number | undefined => {
    const amount = Number(raw);
    return raw.trim() !== "" && Number.isFinite(amount) && amount > 0 ? amount : undefined;
  };
  const salaryMin = toPesos(debouncedSalaryMin);
  const salaryMax = toPesos(debouncedSalaryMax);
  const salaryRangeBackwards = salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax;
  const salaryError = salaryRangeBackwards ? "Minimum salary cannot be higher than the maximum." : undefined;
  // A backwards range is not sent: the list keeps its last good result until it is fixed.
  const salaryParams = salaryRangeBackwards ? {} : { salaryMin, salaryMax };

  // Pick up search filters carried over from the landing page (e.g. /app/jobs?q=forklift).
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: routeSearch.q ?? "", location: routeSearch.location ?? "" }));
    setPage(1);
  }, [routeSearch.q, routeSearch.location]);

  const [allOpeningsCount, setAllOpeningsCount] = useState<number>(0);

  const jobsQuery = useQuery<PaginatedListResponse<JobPosting>>({
    queryKey: [
      "applicant",
      "jobs",
      scope,
      { search: debouncedSearch, location: locationFilter, ...salaryParams, page },
    ],
    queryFn: ({ signal }) => {
      const filterParams = {
        search: debouncedSearch || undefined,
        location: locationFilter || undefined,
        ...salaryParams,
        page,
        limit: pageSize,
      };

      return scope === "all"
        ? applicantJobsApi.getJobsPage(filterParams, { signal })
        : applicantJobsApi.getSavedJobsPage(filterParams, { signal });
    },
    placeholderData: (previousData, previousQuery) => {
      const previousScope = previousQuery?.queryKey?.[2];
      if (previousScope !== scope) return undefined;
      return previousData;
    },
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
      queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Saved", "Position added to your saved jobs.");
    },
    onError: (err: any) => notify.error("Save Failed", err),
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Removed", "Position removed from your saved jobs.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });

  const [confirmClearSaved, setConfirmClearSaved] = useState(false);
  const clearSavedMutation = useMutation({
    mutationFn: () => applicantJobsApi.clearSavedJobs(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      setConfirmClearSaved(false);
      setPage(1);
      notify.success("Saved Jobs Cleared", "All jobs were removed from your saved list.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });
  const savedCount = savedJobIds.size;
  const atSaveLimit = savedCount >= MAX_SAVED_JOBS;

  const toggleBookmark = (jobId: number) => {
    if (!savedJobIds.has(jobId) && atSaveLimit) {
      notify.error("Saved Jobs Limit", `You can save up to ${MAX_SAVED_JOBS} jobs. Remove one to save another.`);
      return;
    }
    if (savedJobIds.has(jobId)) {
      unsaveMutation.mutate(jobId);
    } else {
      saveMutation.mutate(jobId);
    }
  };

  const jobData = jobsQuery.data;
  const isServerPaginated = Boolean(jobData && !Array.isArray(jobData));
  const rawJobs = Array.isArray(jobData) ? jobData : jobData?.items ?? [];

  const paginatedJobs = isServerPaginated
    ? (jobData?.items ?? [])
    : (scope === "saved" ? rawJobs.filter((job) => savedJobIds.has(job.id)) : rawJobs).slice(
        (page - 1) * pageSize,
        page * pageSize,
      );

  const totalItems = isServerPaginated
    ? (jobData?.total ?? 0)
    : (scope === "saved" ? rawJobs.filter((job) => savedJobIds.has(job.id)).length : rawJobs.length);

  const totalPages = isServerPaginated
    ? Math.max(1, jobData?.totalPages ?? 1)
    : Math.max(1, Math.ceil(totalItems / pageSize));

  const displayedJobs = paginatedJobs;

  // The tab count is the whole list, so it only follows results that have no filters applied.
  const isUnfiltered = !debouncedSearch && !locationFilter && salaryMin === undefined && salaryMax === undefined;
  useEffect(() => {
    if (scope !== "all" || !isUnfiltered) return;
    if (isServerPaginated && jobData?.total !== undefined) {
      setAllOpeningsCount(jobData.total);
    } else if (Array.isArray(jobData)) {
      setAllOpeningsCount(jobData.length);
    }
  }, [scope, isUnfiltered, isServerPaginated, jobData]);

  const handleFilterChange = (patch: Partial<JobFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const handleReset = () => {
    setFilters({ search: "", location: "", salaryMin: "", salaryMax: "" });
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some((value) => value.trim() !== "");

  const formatPeso = (amount: number) => `₱${amount.toLocaleString("en-PH")}`;
  const salarySummary =
    salaryMin && salaryMax
      ? `${formatPeso(salaryMin)} – ${formatPeso(salaryMax)} per month`
      : salaryMin
        ? `From ${formatPeso(salaryMin)} per month`
        : salaryMax
          ? `Up to ${formatPeso(salaryMax)} per month`
          : null;
  const activeSummary = [locationFilter ? jobLocationLabel(locationFilter) : null, salarySummary]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "all" ? "Explore jobs" : "Saved jobs"}
        description={
          scope === "all"
            ? "Browse current openings and apply when a role suits you. Locations are the worksite, not the MEGS office in Valenzuela City."
            : "Review bookmarked job openings and continue your applications."
        }
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: scope === "all" ? "Explore jobs" : "Saved Jobs" },
        ]}
        actions={
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-1 text-sm">
            <button
              type="button"
              onClick={() => {
                setScope("all");
                setPage(1);
              }}
              aria-pressed={scope === "all"}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-3.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
                scope === "all" ? "bg-navy text-white" : "text-slate-700 hover:bg-navy-soft hover:text-navy",
              )}
            >
              <Briefcase className="size-4" aria-hidden="true" />
              <span>All Openings ({allOpeningsCount || totalItems})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setScope("saved");
                setPage(1);
              }}
              aria-pressed={scope === "saved"}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-3.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1",
                scope === "saved" ? "bg-navy text-white" : "text-slate-700 hover:bg-navy-soft hover:text-navy",
              )}
            >
              <Bookmark className="size-4" aria-hidden="true" />
              <span>Saved Jobs ({savedCount}/{MAX_SAVED_JOBS})</span>
            </button>
          </div>
        }
      />

      {isDeployed && (
        <div className="rounded-lg border border-slate-300 border-l-4 border-l-navy bg-white p-4">
          <p className="text-sm text-slate-700">
            <strong className="text-slate-950">Notice:</strong> You are currently on an active assignment{deploymentQuery.data?.clientName ? ` with ${deploymentQuery.data.clientName}` : ""}. You can browse and bookmark positions for your records, but applications remain locked until your contract reaches redeployment.
          </p>
        </div>
      )}

      {scope === "saved" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2" role="status">
          <p className={cn("text-sm", atSaveLimit ? "font-medium text-megs-red" : "text-slate-700")}>
            <span className="font-semibold">{savedCount}/{MAX_SAVED_JOBS}</span> saved jobs
            {atSaveLimit && " · Limit reached. Remove one to save another."}
          </p>
          {savedCount > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearSaved(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-megs-red hover:bg-megs-red-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-megs-red"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Clear all saved jobs
            </button>
          )}
        </div>
      )}

      <JobFilters values={filters} onChange={handleFilterChange} salaryError={salaryError} />

      {/* Results */}
      {jobsQuery.isLoading ? (
        <LoadingState variant="cards" />
      ) : jobsQuery.isError ? (
        <ErrorState error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : displayedJobs.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8">
          {hasActiveFilters ? (
            <EmptyState
              icon={<SearchX className="size-5 text-slate-600" aria-hidden="true" />}
              title="No jobs match these filters"
              description="Try a wider salary range, a nearby city or fewer keywords."
              action={
                <Button variant="outline" size="md" className="border-megs-red/40 text-megs-red hover:bg-megs-red-tint hover:text-megs-red" onClick={handleReset}>
                  Clear filters
                </Button>
              }
            />
          ) : scope === "saved" ? (
            <EmptyState
              icon={<Bookmark className="size-5 text-navy" aria-hidden="true" />}
              title="No saved jobs yet"
              description="Bookmark job openings while exploring careers so you can review and apply when ready."
              action={
                <Button variant="primary" size="md" onClick={() => setScope("all")}>
                  Explore all openings
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Briefcase className="size-5 text-slate-600" aria-hidden="true" />}
              title="No openings right now"
              description="New positions are posted regularly. Check back soon."
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1" role="status">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-slate-950">
                {totalItems} {totalItems === 1 ? "job" : "jobs"}
              </span>
              {activeSummary && <span> · {activeSummary}</span>}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-11 rounded-md px-2 text-sm font-medium text-megs-red underline-offset-4 hover:bg-megs-red-tint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-megs-red"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
            {paginatedJobs.map((job) => (
              <JobCard key={job.id} job={job} saved={savedJobIds.has(job.id)} saveDisabled={atSaveLimit} onToggleSave={toggleBookmark} />
            ))}
          </div>

          <div className="rounded-lg border border-slate-300 bg-white p-2">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              itemLabel="jobs"
            />
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirmClearSaved}
        onClose={() => setConfirmClearSaved(false)}
        onConfirm={() => clearSavedMutation.mutate()}
        title="Clear all saved jobs?"
        description={`This removes all ${savedCount} saved jobs from your list. The job postings themselves are not affected.`}
        confirmLabel="Clear all"
        variant="danger"
        loading={clearSavedMutation.isPending}
      />
    </div>
  );
};
