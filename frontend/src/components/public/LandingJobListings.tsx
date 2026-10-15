import React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { useAuth } from "../../hooks/useAuth";
import { Role } from "../../lib/types/enums";
import { formatDate, formatSalaryRange } from "../../lib/utils";
import { Briefcase, MapPin, Building, Calendar, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { normalizeServerSearch, SERVER_SEARCH_DEBOUNCE_MS } from "../../lib/query-policies";
import { Button } from "@/components/shadcn/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Search positions",
    description:
      "Filter open positions by keyword, qualification and location to find roles that fit your experience.",
  },
  {
    number: "02",
    title: "Submit application",
    description:
      "Create a candidate account and submit your profile or upload your resume for immediate screening by talent acquisition.",
  },
  {
    number: "03",
    title: "Interview and deploy",
    description:
      "Track your evaluation status, complete pre-employment requirements, and receive deployment dispatch instructions.",
  },
];

const formatEmploymentType = (value: string) => {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

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
  const search = normalizeServerSearch(useDebouncedValue(searchQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const location = normalizeServerSearch(useDebouncedValue(locationQuery, SERVER_SEARCH_DEBOUNCE_MS));
  const pageSize = 6;

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
  const MAX_VISIBLE_JOBS = pageSize;
  const visibleJobs = jobs.slice(0, MAX_VISIBLE_JOBS);
  const remainingCount = Math.max(0, totalJobs - visibleJobs.length);

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
    <section id="jobs" className="scroll-mt-20 bg-page py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="jobs-heading"
          title="Latest job openings"
          intro="Direct openings currently accepting applications through our recruitment network."
          action={
            hasActiveFilter ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Filtered results {totalJobs > 0 && `(${totalJobs} found)`}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={onClearSearch} className="text-accent">
                  Clear filter
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* How it works */}
        <ol
          id="how-it-works"
          aria-label="How it works"
          className="mt-8 grid scroll-mt-20 grid-cols-1 border-y border-border md:grid-cols-3 md:divide-x md:divide-border"
        >
          {HOW_IT_WORKS_STEPS.map((step) => (
            <li
              key={step.number}
              className="flex gap-4 border-b border-border py-5 last:border-b-0 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0"
            >
              <span className="font-display text-xl tabular-nums text-secondary" aria-hidden="true">
                {step.number}
              </span>
              <div>
                <h3 className="text-base font-semibold text-secondary">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* 4-State UI */}
        {jobsQuery.isLoading && (
          <ul className="mt-8 divide-y divide-border border-y border-border" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <li key={idx} className="flex animate-pulse items-center justify-between gap-6 py-6">
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-1/2 rounded-md bg-muted" />
                  <div className="h-4 w-1/3 rounded-md bg-muted" />
                  <div className="h-3 w-3/4 rounded-md bg-muted" />
                </div>
                <div className="h-11 w-28 rounded-md bg-muted" />
              </li>
            ))}
          </ul>
        )}

        {jobsQuery.isError && (
          <Alert variant="destructive" className="mx-auto mt-8 max-w-lg">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Unable to load job listings</AlertTitle>
            <AlertDescription>
              <p>Could not connect to the recruitment database. Please try again.</p>
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
            <h3 className="mt-4 text-base font-semibold text-secondary">No matching jobs found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilter
                ? `No open vacancies match "${searchQuery || locationQuery}". Try checking for spelling or searching broader terms.`
                : "There are currently no active job requisitions published. Please check back soon."}
            </p>
            {hasActiveFilter && (
              <Button type="button" variant="secondary" className="mt-5" onClick={onClearSearch}>
                Reset search filter
              </Button>
            )}
          </div>
        )}

        {!jobsQuery.isLoading && !jobsQuery.isError && totalJobs > 0 && (
          <Reveal>
            <ul className="mt-8 divide-y divide-border border-y border-border">
              {visibleJobs.map((job) => {
                const clientName = (job as any).mrf?.client?.name || "Verified Client";
                const industry = (job as any).mrf?.client?.industry;
                const employmentType = (job as any).mrf?.employmentType;

                return (
                  <li key={job.id}>
                    <article className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between md:gap-8">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold tracking-tight text-lg leading-snug text-secondary">{job.title}</h3>
                          {employmentType && (
                            <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
                              {formatEmploymentType(employmentType)}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-start gap-1.5">
                            <Building className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0">
                              <span className="font-medium text-foreground">{clientName}</span>
                              {industry && <span className="text-muted-foreground"> · {industry}</span>}
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="size-4 shrink-0" aria-hidden="true" />
                            <span>{job.location || "Philippines"}</span>
                          </span>
                          {((job as any).mrf?.salaryRangeMin || (job as any).mrf?.salaryRangeMax) ? (
                            <span className="font-semibold text-secondary">
                              {formatSalaryRange((job as any).mrf.salaryRangeMin, (job as any).mrf.salaryRangeMax)}
                            </span>
                          ) : null}
                          <span className="flex items-center gap-1.5">
                            <Calendar className="size-4 shrink-0" aria-hidden="true" />
                            <span>Posted {formatDate(job.createdAt)}</span>
                          </span>
                        </div>

                        {job.description && (
                          <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                            {job.description}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-4 md:flex-col md:items-end md:gap-2">
                        <span className="text-sm text-muted-foreground">
                          {isAuthenticated ? "Apply in one click" : "Sign in to apply"}
                        </span>
                        <Button type="button" variant="outline" onClick={() => handleApplyClick(job.id)}>
                          <span>Apply</span>
                          <ArrowRight aria-hidden="true" />
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground" role="status">
                {hasActiveFilter
                  ? `Showing ${visibleJobs.length} of ${totalJobs} matching ${totalJobs === 1 ? "role" : "roles"}`
                  : `Showing ${visibleJobs.length} of ${totalJobs} open ${totalJobs === 1 ? "role" : "roles"}`}
              </p>
              {remainingCount > 0 && (
                <Button type="button" variant="secondary" onClick={handleViewAllJobs}>
                  <span>View all {totalJobs} jobs</span>
                  <ArrowRight aria-hidden="true" />
                </Button>
              )}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
};
