import React from "react";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { m, staggerItem, staggerParent } from "./motion";

export interface LandingFeaturedCompaniesProps {
  selectedCompany: string;
  onSelectCompany: (companyName: string) => void;
}

const MAX_COMPANIES = 6;

/** Compact "hiring now" filter row shown inside the jobs section, one line under the popular searches. */
export const LandingFeaturedCompanies: React.FC<LandingFeaturedCompaniesProps> = ({
  selectedCompany,
  onSelectCompany,
}) => {
  const { data: employerSummary } = useQuery({
    queryKey: ["public-open-job-employers"],
    queryFn: ({ signal }) => applicantJobsApi.getOpenEmployerSummary({ signal }),
  });
  const companies = (employerSummary?.employers ?? []).slice(0, MAX_COMPANIES);

  if (companies.length === 0) {
    return null;
  }

  return (
    <div id="companies" className="mt-2 flex flex-col gap-x-3 gap-y-2 sm:flex-row sm:items-start">
      <h3 className="mr-1 text-sm font-normal text-muted-foreground sm:flex sm:min-h-10 sm:items-center">Hiring now:</h3>
      <m.ul {...staggerParent(0.05)} className="flex flex-1 flex-wrap gap-2">
        {companies.map((comp) => {
          const isActive = selectedCompany === comp.name;
          return (
            <m.li key={comp.name} {...staggerItem}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelectCompany(isActive ? "" : comp.name)}
                className="inline-flex min-h-11 max-w-full cursor-pointer items-center gap-x-2 rounded-md border border-border bg-background px-3 py-1.5 text-left text-sm font-medium text-secondary transition-[color,background-color,border-color,transform] duration-150 hover:border-secondary active:scale-95 aria-pressed:border-secondary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:active:scale-100 md:pointer-fine:min-h-10"
              >
                {comp.name}
                <span className="shrink-0 whitespace-nowrap tabular-nums opacity-70">
                  {comp.jobCount} {comp.jobCount === 1 ? "opening" : "openings"}
                </span>
              </button>
            </m.li>
          );
        })}
      </m.ul>
    </div>
  );
};
