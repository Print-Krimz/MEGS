import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { ArrowRight } from "lucide-react";
import { Pagination } from "../common";
import { Button } from "@/components/shadcn/button";
import { SectionHeader } from "./SectionHeader";
import { Reveal } from "./motion";

export interface LandingFeaturedCompaniesProps {
  onSelectCompany: (companyName: string) => void;
}

const PAGE_SIZE = 6;

export const LandingFeaturedCompanies: React.FC<LandingFeaturedCompaniesProps> = ({ onSelectCompany }) => {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: employerSummary } = useQuery({
    queryKey: ["public-open-job-employers"],
    queryFn: ({ signal }) => applicantJobsApi.getOpenEmployerSummary({ signal }),
  });
  const companies = employerSummary?.employers ?? [];
  const totalPages = Math.ceil(companies.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  if (companies.length === 0) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedCompanies = companies.slice(startIndex, startIndex + PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    const sectionEl = document.getElementById("companies");
    if (sectionEl && typeof sectionEl.scrollIntoView === "function") {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section id="companies" className="scroll-mt-20 bg-background py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          title="Featured companies"
          intro="Partner employers currently deploying staff through the MEGS recruitment system."
        />

        <Reveal>
          <ul className="mt-8 grid grid-cols-1 border-t border-border md:grid-cols-2 md:gap-x-12">
            {paginatedCompanies.map((comp) => (
              <li
                key={comp.name}
                className="flex items-center justify-between gap-4 border-b border-border py-4"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-secondary">{comp.name}</h3>
                  {comp.industry && <p className="mt-0.5 text-sm text-muted-foreground">{comp.industry}</p>}
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {`${comp.jobCount} open ${comp.jobCount === 1 ? "vacancy" : "vacancies"}`}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onSelectCompany(comp.name)}
                  className="shrink-0 text-accent"
                >
                  <span>View jobs</span>
                  <ArrowRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </Reveal>

        {totalPages > 1 && (
          <div className="mt-8">
            <Pagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalItems={companies.length}
              pageSize={PAGE_SIZE}
              onPageChange={handlePageChange}
              itemLabel="companies"
              className="border-border"
            />
          </div>
        )}
      </div>
    </section>
  );
};
