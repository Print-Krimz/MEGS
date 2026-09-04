import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import { JobCard } from "../applicant/JobCard";
import { Briefcase, ArrowRight, Sparkles } from "lucide-react";

export const LandingFeaturedJobs: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["public", "featured-jobs"],
    queryFn: () => applicantJobsApi.getJobs({ limit: 6 }),
    staleTime: 60 * 1000,
  });

  // Sample fallback positions if database currently has few entries
  const sampleJobs = [
    {
      id: 1,
      title: "Industrial Automation Specialist",
      company: "San Miguel Yamamura",
      location: "Valenzuela City",
      workSetup: "ON_SITE",
      salaryRange: "₱45,000 – ₱60,000 / mo",
      employmentType: "Full-time",
      description: "Operate and troubleshoot PLC-controlled automated bottling and packaging machinery.",
      requirements: "PLC, Electrical Maintenance, Industrial Safety",
      skills: ["PLC Programming", "Automation", "Troubleshooting"],
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      title: "Warehouse Operations Supervisor",
      company: "Universal Robina Corp.",
      location: "Quezon City",
      workSetup: "ON_SITE",
      salaryRange: "₱38,000 – ₱50,000 / mo",
      employmentType: "Full-time",
      description: "Lead dispatch operations, inventory audits, and logistics fleet coordination.",
      requirements: "Supply Chain, Inventory Control, Leadership",
      skills: ["Inventory Management", "Logistics", "Dispatch"],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 3,
      title: "Electrical Maintenance Technician",
      company: "Megaworld Commercial",
      location: "Laguna",
      workSetup: "ON_SITE",
      salaryRange: "₱28,000 – ₱36,000 / mo",
      employmentType: "Full-time",
      description: "Preventive maintenance on switchgears, commercial HVAC, and backup generator systems.",
      requirements: "TESDA NC-II Electrician, Schematics Reading",
      skills: ["Wiring", "HVAC", "Safety Compliance"],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 4,
      title: "Full-Stack Web Developer",
      company: "MEGS Digital Systems",
      location: "Metro Manila",
      workSetup: "HYBRID",
      salaryRange: "₱65,000 – ₱85,000 / mo",
      employmentType: "Full-time",
      description: "Develop enterprise recruitment portal interfaces, API integrations, and database schemas.",
      requirements: "React, Node.js, PostgreSQL, TypeScript",
      skills: ["React", "TypeScript", "Node.js"],
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
  ];

  const displayedJobs = (jobs && jobs.length > 0) ? jobs.slice(0, 6) : sampleJobs;

  return (
    <section id="featured-jobs" className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/70 text-blue-800 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Verified Openings</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
              Featured Opportunities
            </h2>
            <p className="text-sm text-slate-600">
              Browse actively recruiting positions with transparent details and competitive compensation.
            </p>
          </div>

          <Link
            to="/app/jobs"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors shrink-0"
          >
            <span>View all open jobs</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Job Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-5">
          {displayedJobs.map((job) => (
            <JobCard
              key={job.id}
              id={job.id}
              title={job.title}
              company={(job as any).client?.name || (job as any).company || "MAR Employment (MEGS)"}
              location={job.location || "Philippines"}
              workSetup={(job as any).workSetup || "ON_SITE"}
              salaryRange={(job as any).salaryRange}
              employmentType={(job as any).employmentType || "Full-time"}
              description={job.description}
              requirements={job.requirements}
              skills={(job as any).skills}
              createdAt={job.createdAt}
              status={job.status}
              detailUrl={`/app/jobs/${job.id}`}
            />
          ))}
        </div>

        {/* Bottom CTA bar */}
        <div className="text-center pt-4">
          <Link
            to="/app/jobs"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-xs transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            <span>Explore All Open Positions</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
