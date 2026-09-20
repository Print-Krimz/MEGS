import React from "react";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { Building2, ShieldCheck } from "lucide-react";

export interface LandingFeaturedCompaniesProps {
  onSelectCompany: (companyName: string) => void;
}

export const LandingFeaturedCompanies: React.FC<LandingFeaturedCompaniesProps> = ({ onSelectCompany }) => {
  const { data: jobs = [] } = useQuery({
    queryKey: ["public-open-jobs-companies"],
    queryFn: () => applicantJobsApi.getJobs(),
  });

  // Extract unique companies from real job postings that have client records
  const companyMap = new Map<string, { name: string; industry?: string; jobCount: number }>();

  // Update counts from real active jobs only — never invent placeholder employers
  jobs.forEach((job) => {
    const client = (job as any).mrf?.client;
    if (client?.name) {
      const existing = companyMap.get(client.name);
      if (existing) {
        existing.jobCount += 1;
      } else {
        companyMap.set(client.name, {
          name: client.name,
          industry: client.industry,
          jobCount: 1,
        });
      }
    }
  });

  const companies = Array.from(companyMap.values());

  if (companies.length === 0) {
    return null;
  }

  return (
    <section id="companies" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pb-6 border-b border-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Verified Partners
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Featured Companies
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Partner employers currently deploying staff through the MEGS recruitment system.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {companies.map((comp) => (
            <div
              key={comp.name}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#e8eef6] text-[#0f294a] flex items-center justify-center font-bold text-sm">
                  <Building2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0f294a] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0f294a]" aria-hidden="true" />
                  <span>Verified</span>
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{comp.name}</h3>
                {comp.industry && (
                  <p className="text-xs text-slate-500 mt-0.5">{comp.industry}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  {`${comp.jobCount} open ${comp.jobCount === 1 ? "vacancy" : "vacancies"}`}
                </span>

                <button
                  type="button"
                  onClick={() => onSelectCompany(comp.name)}
                  className="font-bold text-[#0f294a] hover:underline cursor-pointer min-h-[32px] px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f294a] rounded"
                >
                  View Jobs
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
