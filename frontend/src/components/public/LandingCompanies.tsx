import React from "react";
import { Link } from "@tanstack/react-router";
import { CompanyCard } from "../applicant/CompanyCard";
import { Building2, ArrowRight } from "lucide-react";

export const LandingCompanies: React.FC = () => {
  const companies = [
    {
      name: "San Miguel Yamamura Fuso",
      industry: "Packaging & Industrial Manufacturing",
      location: "Valenzuela & Laguna",
      openJobsCount: 12,
    },
    {
      name: "Universal Robina Corporation",
      industry: "Food & Beverage Consumer Goods",
      location: "Quezon City & Cavite",
      openJobsCount: 8,
    },
    {
      name: "Megaworld Commercial Properties",
      industry: "Facilities & Property Management",
      location: "Taguig & Pasay",
      openJobsCount: 6,
    },
    {
      name: "Fast Logistics Group",
      industry: "Supply Chain & Distribution",
      location: "Metro Manila & Cebu",
      openJobsCount: 15,
    },
  ];

  return (
    <section id="companies" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-blue-800 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>Hiring Partners</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
              Featured Employers Hiring Now
            </h2>
            <p className="text-sm text-slate-600">
              Work with reputable Philippine companies offering stable employment, statutory benefits, and growth.
            </p>
          </div>

          <Link
            to="/app/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors shrink-0"
          >
            <span>Browse all employers</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {companies.map((company, idx) => (
            <CompanyCard
              key={idx}
              id={idx + 1}
              name={company.name}
              industry={company.industry}
              location={company.location}
              openJobsCount={company.openJobsCount}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
