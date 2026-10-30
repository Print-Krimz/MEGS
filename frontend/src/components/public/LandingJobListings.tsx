import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { formatDate, formatEmploymentType, formatSalaryRange } from "../../lib/utils";
import { Briefcase, MapPin, ArrowRight, AlertCircle, RefreshCw, Search } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import { Button } from "@/components/shadcn/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/shadcn/input-group";
import { cn } from "../../lib/shadcn-utils";
import { SectionHeader } from "./SectionHeader";
import { Reveal, m, staggerItem, staggerParent } from "./motion";

const HOW_IT_WORKS_STEPS = [
  { number: "1", title: "Find a position", description: "Search by job title, skill or city." },
  { number: "2", title: "Apply online", description: "Make a free MEGS account and send your application." },
  { number: "3", title: "Interview and start", description: "Our recruiters call you for screening and deployment." },
];

const POPULAR_SEARCHES = ["Production Worker", "Forklift Operator", "Warehouse Crew", "Delivery Driver"];

/** Known types read as "Full-time"; anything else is sentence-cased from its enum value. */
const employmentTypeLabel = (value: string) => {
  const known = formatEmploymentType(value);
  if (known !== value.replace(/_/g, " ")) return known;
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** Shared by the real cards and their loading skeletons so the grid does not shift on load. */
const CARD_MIN_HEIGHT = "min-h-[21rem] xl:min-h-[19rem]";

export interface LandingJobListingsProps {
  searchQuery: string;
  locationQuery: string;
  onSearchChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onClearSearch: () => void;
  /** Rendered between the search form and the results, e.g. the hiring-companies row. */
  children?: React.ReactNode;
}

export const LandingJobListings: React.FC<LandingJobListingsProps> = ({
  searchQuery,
  locationQuery,
  onSearchChange,
  onLocationChange,
  onClearSearch,
  children,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const search = normalizeServerSearch(useDebouncedValue(searchQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const location = normalizeServerSearch(useDebouncedValue(locationQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const pageSize = 4;

  const jobsQuery = useQuery({
    queryKey: ["public-open-jobs", { search, location, page: 1, pageSize }],
    queryFn: ({ signal }) => applicantJobsApi.getJobsPage({
      search: search || undefined,
      location: location || undefined,
      page: 1,
      limit: pageSize,
    }, { signal }),
    placeholderData: keepPreviousData,
  });

  const jobs = jobsQuery.data?.items ?? [];
  const totalJobs = jobsQuery.data?.total ?? 0;
  const hasActiveFilter = Boolean(searchQuery || locationQuery);
  const visibleJobs = jobs.slice(0, pageSize);
  const remainingCount = Math.max(0, totalJobs - visibleJobs.length);

  const isApplicant = isAuthenticated && user?.role === Role.APPLICANT;

  const handleViewAllJobs = () => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (locationQuery.trim()) params.set("location", locationQuery.trim());
    const qs = params.toString();

    if (isAuthenticated && user?.role === Role.APPLICANT) {
      navigate({
        to: "/app/jobs",
        search: Object.fromEntries(params) as any,
      });
    } else {
      navigate({
        to: "/login",
        search: { redirect: qs ? `/app/jobs?${qs}` : "/app/jobs" },
      });
    }
  };

  return (
    <section id="jobs" className="scroll-mt-20 border-t border-border bg-page py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeader
            id="jobs-heading"
            title="Featured jobs"
            intro="Current openings at MEGS client companies. Apply online with a free account."
          />
        </Reveal>

        <form
          role="search"
          aria-label="Job Search"
          onSubmit={(e) => {
            e.preventDefault();
            document.getElementById("jobs-results")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
          }}
          className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              id="jobs-keyword"
              aria-label="Job title or keyword"
              placeholder="Job title or skill"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </InputGroup>
          <InputGroup>
            <InputGroupAddon>
              <MapPin aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              type="text"
              id="jobs-location"
              aria-label="Location"
              placeholder="City or area"
              value={locationQuery}
              onChange={(e) => onLocationChange(e.target.value)}
            />
          </InputGroup>
          <Button
            type="submit"
            size="lg"
            className="transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 sm:px-8"
          >
            <Search data-icon="inline-start" aria-hidden="true" />
            Search jobs
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted-foreground">Popular:</span>
          {POPULAR_SEARCHES.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={searchQuery === tag}
              onClick={() => onSearchChange(searchQuery === tag ? "" : tag)}
              className="min-h-11 cursor-pointer rounded-full border border-border bg-background px-4 text-sm font-medium text-secondary transition-[color,background-color,border-color,transform] duration-150 hover:border-secondary active:scale-95 aria-pressed:border-secondary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 md:pointer-fine:min-h-10"
            >
              {tag}
            </button>
          ))}
        </div>

        {children}

        <div id="jobs-results" className="scroll-mt-24">
          {jobsQuery.isLoading && (
            <ul className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5" aria-hidden="true">
              {[1, 2, 3, 4].map((idx) => (
                <li
                  key={idx}
                  className={cn(
                    "flex animate-pulse flex-col rounded-lg border border-border bg-background p-5 motion-reduce:animate-none sm:p-6",
                    CARD_MIN_HEIGHT
                  )}
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
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => jobsQuery.refetch()}>
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
                  ? `No open roles match "${searchQuery || locationQuery}". Check the spelling or try a broader term.`
                  : "No roles are open right now. Check back soon."}
              </p>
              {hasActiveFilter && (
                <Button type="button" variant="secondary" className="mt-5" onClick={onClearSearch}>
                  Reset search filter
                </Button>
              )}
            </div>
          )}

          {!jobsQuery.isLoading && !jobsQuery.isError && totalJobs > 0 && (
            <div className="mt-6">
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <p className="text-sm text-muted-foreground" role="status">
                  {`Showing ${visibleJobs.length} of ${totalJobs} ${hasActiveFilter ? "matching" : "open"} ${totalJobs === 1 ? "role" : "roles"}`}
                </p>
                {hasActiveFilter && (
                  <Button type="button" variant="ghost" size="sm" onClick={onClearSearch} className="text-accent">
                    Clear filter
                  </Button>
                )}
              </div>

              {/* Keyed by the result set so a new search re-enters as a fresh staggered list. */}
              <m.ul
                key={visibleJobs.map((job) => job.id).join("-")}
                aria-busy={jobsQuery.isFetching}
                {...staggerParent(0.07)}
                className={cn(
                  "mt-3 grid gap-4 transition-opacity duration-200 md:grid-cols-2 md:gap-5",
                  jobsQuery.isFetching && "opacity-60"
                )}
              >
                {visibleJobs.map((job) => {
                  const clientName = job.mrf?.client?.name;
                  const industry = job.mrf?.client?.industry;
                  const employmentType = job.mrf?.employmentType;
                  const location = job.location || job.mrf?.location;
                  const salaryMin = job.mrf?.salaryRangeMin;
                  const salaryMax = job.mrf?.salaryRangeMax;
                  const hasSalary = Boolean(salaryMin || salaryMax);
                  const applyContent = (
                    <>
                      <span>Apply</span>
                      <ArrowRight
                        aria-hidden="true"
                        className="transition-transform duration-200 group-hover/card:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover/card:translate-x-0"
                      />
                    </>
                  );

                  return (
                    <m.li key={job.id} {...staggerItem} className="flex">
                      <article
                        className={cn(
                          "group/card relative flex w-full flex-col rounded-lg border border-border bg-background p-5 sm:p-6",
                          CARD_MIN_HEIGHT,
                          "transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-secondary/50",
                          "has-[:focus-visible]:border-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                          "motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                        )}
                      >
                        <h3 className="line-clamp-2 text-xl font-bold leading-snug tracking-tight text-secondary decoration-accent decoration-2 underline-offset-4 transition-colors group-hover/card:text-accent group-hover/card:underline">
                          {job.title}
                        </h3>

                        {clientName && (
                          <p className="mt-2 line-clamp-1 text-sm">
                            <span className="font-semibold text-foreground">{clientName}</span>
                            {industry && <span className="text-muted-foreground"> / {industry}</span>}
                          </p>
                        )}
                        {location && (
                          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-1">{location}</span>
                          </p>
                        )}

                        {job.description && (
                          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {job.description}
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
                          <div className="mt-3 flex items-center justify-between gap-4">
                            <span className="text-sm text-muted-foreground">Posted {formatDate(job.createdAt)}</span>
                            <Button
                              asChild
                              variant="outline"
                              className="transition-[background-color,border-color,color,transform] duration-200 after:absolute after:inset-0 after:rounded-lg after:content-[''] active:scale-[0.97] group-hover/card:border-primary group-hover/card:bg-primary group-hover/card:text-primary-foreground motion-reduce:active:scale-100"
                            >
                              {isApplicant ? (
                                <Link to="/app/jobs/$jobId" params={{ jobId: String(job.id) }} aria-label={`Apply for ${job.title}`}>
                                  {applyContent}
                                </Link>
                              ) : (
                                <Link to="/login" search={{ redirect: `/app/jobs/${job.id}` }} aria-label={`Apply for ${job.title}`}>
                                  {applyContent}
                                </Link>
                              )}
                            </Button>
                          </div>
                        </div>
                      </article>
                    </m.li>
                  );
                })}
              </m.ul>

              {remainingCount > 0 && (
                <div className="mt-6 flex justify-center sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleViewAllJobs}
                    className="group transition-[background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100"
                  >
                    <span>View all {totalJobs} jobs</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                    />
                  </Button>
                </div>
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
            <m.li key={step.number} {...staggerItem} className="flex items-start gap-3">
              <span
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-secondary-foreground"
                aria-hidden="true"
              >
                {step.number}
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
