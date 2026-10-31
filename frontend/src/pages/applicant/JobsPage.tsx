import React, { useState, useEffect, useRef } from "react";
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
import { SALARY_RANGE_MESSAGE, salaryTextError } from "../../lib/field-limits";
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

  const salaryTextProblem = salaryTextError(debouncedSalaryMin) ?? salaryTextError(debouncedSalaryMax);
  const toPesos = (raw: string): number | undefined => {
    const amount = Number(raw);
    return !salaryTextError(raw) && raw.trim() !== "" && Number.isFinite(amount) && amount > 0 ? amount : undefined;
  };
  const salaryMin = toPesos(debouncedSalaryMin);
  const salaryMax = toPesos(debouncedSalaryMax);
  const salaryRangeBackwards = salaryMin !== undefined && salaryMax !== undefined && salaryMin > salaryMax;
  const salaryError = salaryTextProblem ?? (salaryRangeBackwards ? SALARY_RANGE_MESSAGE : undefined);
  // An invalid or backwards range is not sent: the list keeps its last good result until it is fixed.
  const salaryParams = salaryError ? {} : { salaryMin, salaryMax };

  // Pick up search filters carried over from the landing page (e.g. /app/jobs?q=forklift).
  useEffect(() => {
    setFilters((prev) => ({ ...prev, search: routeSearch.q ?? "", location: routeSearch.location ?? "" }));
    setPage(1);
  }, [routeSearch.q, routeSearch.location]);

  const [allOpeningsCount, setAllOpeningsCount] = useState<number>(0);

  // After a page change keyboard and screen-reader focus would stay on the pager button while the page scrolls away.
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusResultsAfterPageChange = useRef(false);
  useEffect(() => {
    if (!focusResultsAfterPageChange.current) return;
    focusResultsAfterPageChange.current = false;
    resultsHeadingRef.current?.focus({ preventScroll: true });
  }, [page]);

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

  // Flip the id in the cache at once so the bookmark fills without waiting for the server.
  const savedIdsKey = ["applicant", "saved-jobs", "ids"];
  const optimisticallySetSaved = async (jobId: number, saved: boolean) => {
    await queryClient.cancelQueries({ queryKey: savedIdsKey });
    const previous = queryClient.getQueryData<number[]>(savedIdsKey);
    queryClient.setQueryData<number[]>(savedIdsKey, (ids = []) =>
      saved ? [...new Set([...ids, jobId])] : ids.filter((id) => id !== jobId),
    );
    return { previous };
  };
  const rollbackSaved = (context?: { previous?: number[] }) => {
    if (context?.previous) queryClient.setQueryData(savedIdsKey, context.previous);
  };
  const refreshSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["applicant", "jobs"] });
    queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
  };

  const saveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.saveJob(jobId),
    onMutate: (jobId) => optimisticallySetSaved(jobId, true),
    onSuccess: () => notify.success("Job Saved", "Position added to your saved jobs."),
    onError: (err: any, _jobId, context) => {
      rollbackSaved(context);
      notify.error("Save Failed", err);
    },
    onSettled: refreshSaved,
  });

  const unsaveMutation = useMutation({
    mutationFn: (jobId: number) => applicantJobsApi.unsaveJob(jobId),
    onMutate: (jobId) => optimisticallySetSaved(jobId, false),
    onSuccess: () => notify.success("Job Removed", "Position removed from your saved jobs."),
    onError: (err: any, _jobId, context) => {
      rollbackSaved(context);
      notify.error("Action Failed", err);
    },
    onSettled: refreshSaved,
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
    if (saveMutation.isPending || unsaveMutation.isPending) return;
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

  // Old results stay on screen while a new search loads; dim them so they are not mistaken for the answer.
  const resultsAreStale = jobsQuery.isFetching && jobsQuery.isPlaceholderData;
  // Offline: the request is queued, not failed, so there is no error to show. Say so instead of an empty list.
  const waitingForNetwork = jobsQuery.fetchStatus === "paused" && (jobsQuery.isPending || jobsQuery.isPlaceholderData);

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
  // A rejected range is not applied, so it must not be described as if it were.
  const salarySummary = salaryError
    ? null
    : salaryMin && salaryMax
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
        title={scope === "all" ? "Browse jobs" : "Saved jobs"}
        description={
          scope === "all"
            ? "Browse current openings and apply when a role suits you. Locations are the worksite, not the MEGS office in Valenzuela City."
            : "Review bookmarked job openings and continue your applications."
        }
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: scope === "all" ? "Browse jobs" : "Saved jobs" },
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
              <span>{jobsQuery.isLoading || jobsQuery.isError || waitingForNetwork ? "All Openings" : `All Openings (${allOpeningsCount || totalItems})`}</span>
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
              <span>{savedJobIdsQuery.isLoading ? "Saved Jobs" : `Saved Jobs (${savedCount}/${MAX_SAVED_JOBS})`}</span>
            </button>
          </div>
        }
      />

      {isDeployed && (
        <div className="rounded-lg border border-navy-line bg-navy-soft p-4">
          <p className="text-sm text-slate-700">
            <strong className="text-slate-950">Notice:</strong> You are currently on an active assignment{deploymentQuery.data?.clientName ? ` with ${deploymentQuery.data.clientName}` : ""}. You can browse and bookmark positions for your records, but applications remain locked until your contract reaches redeployment.
          </p>
        </div>
      )}

      {scope === "saved" && savedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2" role="status">
          {atSaveLimit && (
            <p className="text-sm font-medium text-[#B45309]">Limit reached. Remove one to save another.</p>
          )}
          <button
            type="button"
            onClick={() => setConfirmClearSaved(true)}
            className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-megs-red hover:bg-megs-red-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-megs-red"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Clear all saved jobs
          </button>
        </div>
      )}

      <JobFilters values={filters} onChange={handleFilterChange} salaryError={salaryError} />

      {/* Always mounted so screen readers announce the count when it appears; only the text changes. */}
      <p role="status" className="sr-only">
        {hasActiveFilters && !jobsQuery.isLoading && !jobsQuery.isError && !waitingForNetwork
          ? `${totalItems} ${totalItems === 1 ? "job" : "jobs"} found`
          : ""}
      </p>

      {/* Results */}
      {jobsQuery.isLoading ? (
        <LoadingState variant="cards" rows={4} className="my-0! min-h-[100dvh] content-start gap-4! lg:grid-cols-2!" />
      ) : jobsQuery.isError ? (
        <ErrorState subject="jobs" error={jobsQuery.error} onRetry={() => jobsQuery.refetch()} />
      ) : waitingForNetwork ? (
        <ErrorState subject="jobs" onRetry={() => jobsQuery.refetch()} />
      ) : displayedJobs.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8">
          {hasActiveFilters ? (
            <EmptyState
              bare
              icon={<SearchX className="size-5 text-slate-600" aria-hidden="true" />}
              title="No jobs match these filters"
              description="Try a wider salary range, a nearby city or fewer keywords."
              action={
                <Button variant="outline" size="md" onClick={handleReset}>
                  Clear filters
                </Button>
              }
            />
          ) : scope === "saved" ? (
            <EmptyState
              bare
              icon={<Bookmark className="size-5 text-navy" aria-hidden="true" />}
              title="No saved jobs yet"
              description="Bookmark job openings while exploring careers so you can review and apply when ready."
              action={
                <Button variant="primary" size="md" onClick={() => setScope("all")}>
                  Browse all openings
                </Button>
              }
            />
          ) : (
            <EmptyState
              bare
              icon={<Briefcase className="size-5 text-slate-600" aria-hidden="true" />}
              title="No openings right now"
              description="New positions are posted regularly. Check back soon."
            />
          )}
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", resultsAreStale && "opacity-60")} aria-busy={resultsAreStale}>
          {/* The pager below owns the visible count; this heading is where focus lands after a page change. */}
          <h2 ref={resultsHeadingRef} tabIndex={-1} className="sr-only focus:outline-none">
            Jobs, page {page} of {totalPages}
          </h2>

          {hasActiveFilters && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="text-sm text-slate-700">{activeSummary}</p>
              <button
                type="button"
                onClick={handleReset}
                className="ml-auto min-h-11 rounded-md px-2 text-sm font-medium text-navy underline-offset-4 hover:bg-navy-soft hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Clear filters
              </button>
            </div>
          )}

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
                focusResultsAfterPageChange.current = true;
                const reduceMotion =
                  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
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
