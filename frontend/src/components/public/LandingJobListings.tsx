import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { applicantJobsApi, type JobPosting } from "../../lib/api/applicant-jobs.api";
import { useAuth } from "../../hooks/useAuth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import { cn } from "../../lib/shadcn-utils";
import { Role } from "../../lib/types/enums";
import { formatDate, formatEmploymentType, formatSalaryRange } from "../../lib/utils";
import { getJobEmployerName, stripMarkdownPreview } from "./PublicJobDetailDialog";
import { SectionHeader } from "./SectionHeader";
import { Reveal, m, staggerItem, staggerParent } from "./motion";

const HOW_IT_WORKS_STEPS = [
  { number: "1", title: "Find a position", description: "Search by job title, skill or city." },
  { number: "2", title: "Apply online", description: "Make a free MEGS account and send your application." },
  { number: "3", title: "Interview and start", description: "Our recruiters call you for screening and deployment." },
];

/** Known types read as "Full-time"; anything else is sentence-cased from its enum value. */
const employmentTypeLabel = (value: string) => {
  const known = formatEmploymentType(value);
  if (known !== value.replace(/_/g, " ")) return known;
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Builds compact page numbers with ellipsis when there are many pages. */
function buildPageSequence(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const sequence: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      sequence.push("ellipsis");
    }
    sequence.push(sorted[i]);
  }
  return sequence;
}

const ActiveFilterChip: React.FC<{
  label: string;
  value: string;
  removeLabel: string;
  onRemove: () => void;
}> = ({ label, value, removeLabel, onRemove }) => (
  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-page pl-2.5 pr-0.5 text-sm font-medium text-secondary">
    <span>
      {label}: {value}
    </span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={removeLabel}
      className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-8 md:min-w-8"
    >
      <X className="size-3.5" aria-hidden="true" />
    </button>
  </span>
);

export interface LandingJobListingsProps {
  searchQuery: string;
  locationQuery: string;
  selectedCategory: string;
  selectedEmployer: string;
  page: number;
  onPageChange: (page: number) => void;
  onClearSearch: () => void;
  onClearKeyword: () => void;
  onClearLocation: () => void;
  onClearCategory: () => void;
  onSelectJob: (job: JobPosting) => void;
  /** Rendered in the filter header area, e.g. the hiring-companies row. */
  children?: React.ReactNode;
}

export const LandingJobListings: React.FC<LandingJobListingsProps> = ({
  searchQuery,
  locationQuery,
  selectedCategory,
  selectedEmployer,
  page,
  onPageChange,
  onClearSearch,
  onClearKeyword,
  onClearLocation,
  onClearCategory,
  onSelectJob,
  children,
}) => {
  const { isAuthenticated, user } = useAuth();
  const search = normalizeServerSearch(useDebouncedValue(searchQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const location = normalizeServerSearch(useDebouncedValue(locationQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const pageSize = 6;

  const jobsQuery = useQuery({
    queryKey: ["public-open-jobs", { search, location, page, pageSize }],
    queryFn: ({ signal }) =>
      applicantJobsApi.getJobsPage(
        {
          search: search || undefined,
          location: location || undefined,
          page,
          limit: pageSize,
        },
        { signal }
      ),
    placeholderData: keepPreviousData,
  });

  const jobs = jobsQuery.data?.items ?? [];
  const totalJobs = jobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, jobsQuery.data?.totalPages ?? Math.ceil(totalJobs / pageSize));
  const visibleJobs = jobs.slice(0, pageSize);

  const trimmedKeyword = searchQuery.trim();
  const trimmedLocation = locationQuery.trim();
  const trimmedCategory = selectedCategory.trim();
  const trimmedEmployer = selectedEmployer.trim();
  const hasActiveFilter = Boolean(trimmedKeyword || trimmedLocation || trimmedCategory || trimmedEmployer);

  const startItem = totalJobs === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min((page - 1) * pageSize + visibleJobs.length, totalJobs);
  const isApplicant = isAuthenticated && user?.role === Role.APPLICANT;

  const handlePageSelect = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    onPageChange(nextPage);
    document.getElementById("jobs-results")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="jobs" aria-labelledby="jobs-heading" className="scroll-mt-20 border-b border-border bg-page py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader
            id="jobs-heading"
            title="Open positions"
            intro="Current openings at MEGS client companies. Select any role to view details or apply with a free account."
          />
        </Reveal>

        {children && <div className="mt-6">{children}</div>}

        {hasActiveFilter && (
          <div
            aria-label="Active job filters"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
              {trimmedEmployer ? (
                <ActiveFilterChip
                  label="Employer"
                  value={trimmedEmployer}
                  removeLabel="Remove employer filter"
                  onRemove={onClearKeyword}
                />
              ) : (
                trimmedKeyword && (
                  <ActiveFilterChip
                    label="Keyword"
                    value={trimmedKeyword}
                    removeLabel="Remove keyword filter"
                    onRemove={onClearKeyword}
                  />
                )
              )}

              {trimmedCategory && (
                <ActiveFilterChip
                  label="Industry"
                  value={trimmedCategory}
                  removeLabel="Remove industry filter"
                  onRemove={onClearCategory}
                />
              )}

              {trimmedLocation && (
                <ActiveFilterChip
                  label="Location"
                  value={trimmedLocation}
                  removeLabel="Remove location filter"
                  onRemove={onClearLocation}
                />
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearSearch}
              className="min-h-11 text-accent md:min-h-9"
            >
              Clear filter
            </Button>
          </div>
        )}

        <div id="jobs-results" className="scroll-mt-24">
          {jobsQuery.isLoading && (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <li
                  key={idx}
                  className="flex h-full animate-pulse flex-col rounded-xl border border-border bg-background p-5 motion-reduce:animate-none sm:p-6"
                >
                  <div className="h-6 w-2/3 rounded-md bg-muted" />
                  <div className="mt-3 h-4 w-1/2 rounded-md bg-muted" />
                  <div className="mt-2 h-4 w-2/5 rounded-md bg-muted" />
                  <div className="mt-4 h-3 w-full rounded-md bg-muted" />
                  <div className="mt-2 h-3 w-5/6 rounded-md bg-muted" />
                  <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-4">
                    <div className="h-4 w-1/3 rounded-md bg-muted" />
                    <div className="h-11 w-28 rounded-md bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {jobsQuery.isError && (
            <Alert variant="destructive" className="mx-auto mt-8 max-w-lg">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Unable to load job listings</AlertTitle>
              <AlertDescription>
                <p>The job list did not load. Check your connection and try again.</p>
                <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11 md:min-h-10" onClick={() => jobsQuery.refetch()}>
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  <span>Retry</span>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!jobsQuery.isLoading && !jobsQuery.isError && totalJobs === 0 && (
            <div className="mx-auto mt-8 max-w-lg rounded-lg border border-border bg-background p-10 text-center">
              <Briefcase className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold text-secondary">No matching jobs</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilter
                  ? `No open roles match "${trimmedKeyword || trimmedLocation || trimmedCategory}". Check the spelling or try a broader term.`
                  : "No roles are open right now. Check back soon."}
              </p>
              {hasActiveFilter && (
                <Button type="button" variant="secondary" className="mt-5 min-h-11" onClick={onClearSearch}>
                  Reset search filter
                </Button>
              )}
            </div>
          )}

          {!jobsQuery.isLoading && !jobsQuery.isError && totalJobs > 0 && (
            <div className="mt-6">
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-muted-foreground" role="status">
                  {totalPages > 1
                    ? `Showing ${startItem}–${endItem} of ${totalJobs} ${hasActiveFilter ? "matching" : "open"} roles`
                    : `Showing ${visibleJobs.length} of ${totalJobs} ${hasActiveFilter ? "matching" : "open"} ${totalJobs === 1 ? "role" : "roles"}`}
                </p>
              </div>

              {/* Keyed by the result set so a new search or page re-enters cleanly. */}
              <m.ul
                key={`${page}-${visibleJobs.map((job) => job.id).join("-")}`}
                aria-busy={jobsQuery.isFetching}
                {...staggerParent(0.06)}
                className={cn(
                  "mt-3 grid gap-4 transition-opacity duration-200 md:grid-cols-2 md:gap-5",
                  jobsQuery.isFetching && "opacity-60"
                )}
              >
                {visibleJobs.map((job) => {
                  const employerName = getJobEmployerName(job);
                  const industry = job.mrf?.client?.industry;
                  const employmentType = job.mrf?.employmentType;
                  const locationText = job.location || job.mrf?.location;
                  const salaryMin = job.mrf?.salaryRangeMin;
                  const salaryMax = job.mrf?.salaryRangeMax;
                  const hasSalary = Boolean(salaryMin || salaryMax);
                  const preview = stripMarkdownPreview(job.description);

                  const applyContent = (
                    <>
                      <span>Apply</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover/apply:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/apply:translate-x-0"
                      />
                    </>
                  );

                  return (
                    <m.li key={job.id} {...staggerItem} className="flex">
                      <article
                        className="relative flex h-full w-full flex-col rounded-xl border border-border bg-background p-5 transition-colors hover:border-secondary/40 sm:p-6 has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                      >
                        <h3 className="text-xl font-bold leading-snug tracking-tight text-secondary">
                          <button
                            type="button"
                            onClick={() => onSelectJob(job)}
                            className="line-clamp-2 cursor-pointer text-left transition-colors hover:text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:underline focus-visible:outline-none"
                          >
                            {job.title}
                          </button>
                        </h3>

                        <p className="mt-2 line-clamp-1 text-sm">
                          <span className="font-semibold text-foreground">{employerName}</span>
                          {industry && <span className="text-muted-foreground"> · {industry}</span>}
                        </p>

                        {locationText && (
                          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-1">{locationText}</span>
                          </p>
                        )}

                        {preview && (
                          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {preview}
                          </p>
                        )}

                        <div className="mt-auto pt-5">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-4">
                            {employmentType && (
                              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-secondary">
                                {employmentTypeLabel(employmentType)}
                              </span>
                            )}
                            {hasSalary && (
                              <span className="text-sm font-semibold tabular-nums text-foreground">
                                {formatSalaryRange(salaryMin, salaryMax)}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground">
                              Posted {formatDate(job.createdAt)}
                            </span>
                            <div className="relative z-10 flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => onSelectJob(job)}
                                aria-label={`View details for ${job.title}`}
                                className="min-h-11 px-3 text-secondary hover:bg-muted"
                              >
                                View details
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                className="group/apply min-h-11 transition-[background-color,border-color,color,transform] duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-[0.97] motion-reduce:active:scale-100"
                              >
                                {isApplicant ? (
                                  <Link
                                    to="/app/jobs/$jobId"
                                    params={{ jobId: String(job.id) }}
                                    search={{ apply: "1" }}
                                    aria-label={`Apply for ${job.title}`}
                                  >
                                    {applyContent}
                                  </Link>
                                ) : (
                                  <Link
                                    to="/login"
                                    search={{ redirect: `/app/jobs/${job.id}?apply=1` }}
                                    aria-label={`Apply for ${job.title}`}
                                  >
                                    {applyContent}
                                  </Link>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    </m.li>
                  );
                })}
              </m.ul>

              {totalPages > 1 && (
                <nav
                  aria-label="Job listings pagination"
                  className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
                >
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Page <span className="font-semibold text-secondary">{page}</span> of{" "}
                    <span className="font-semibold text-secondary">{totalPages}</span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => handlePageSelect(page - 1)}
                      aria-label="Previous page"
                      className="min-h-11 min-w-11 px-3"
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>

                    {buildPageSequence(page, totalPages).map((entry, idx) =>
                      entry === "ellipsis" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          aria-hidden="true"
                          className="inline-flex min-h-11 min-w-8 items-center justify-center text-sm text-muted-foreground"
                        >
                          …
                        </span>
                      ) : (
                        <Button
                          key={entry}
                          type="button"
                          variant={entry === page ? "secondary" : "outline"}
                          onClick={() => handlePageSelect(entry)}
                          aria-label={`Page ${entry}`}
                          aria-current={entry === page ? "page" : undefined}
                          className="min-h-11 min-w-11 px-3 tabular-nums"
                        >
                          {entry}
                        </Button>
                      )
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      disabled={page >= totalPages}
                      onClick={() => handlePageSelect(page + 1)}
                      aria-label="Next page"
                      className="min-h-11 min-w-11 px-3"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </nav>
              )}
            </div>
          )}
        </div>

        <m.ol
          id="how-it-works"
          aria-label="How to apply"
          {...staggerParent(0.1)}
          className="mt-12 grid scroll-mt-20 grid-cols-1 gap-4 border-t border-border pt-8 md:grid-cols-3 md:gap-8"
        >
          {HOW_IT_WORKS_STEPS.map((step) => (
            <m.li
              key={step.number}
              {...staggerItem}
              className="flex flex-col gap-1 border-t border-border/70 pt-3 md:border-t-0 md:pt-0"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-primary tabular-nums">
                Step {step.number}
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-secondary">{step.title}.</span> {step.description}
              </p>
            </m.li>
          ))}
        </m.ol>
      </div>
    </section>
  );
};
