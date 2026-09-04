import React from "react";
import { Link } from "@tanstack/react-router";
import { Building2, MapPin, Briefcase, ShieldCheck, ArrowRight } from "lucide-react";

export interface CompanyCardProps {
  id?: string | number;
  name: string;
  industry?: string;
  location?: string;
  openJobsCount?: number;
  logoUrl?: string;
  verified?: boolean;
  className?: string;
}

export const CompanyCard: React.FC<CompanyCardProps> = ({
  id: _id = "1",
  name,
  industry = "Industrial & Commercial",
  location = "Metro Manila",
  openJobsCount = 3,
  logoUrl,
  verified = true,
  className = "",
}) => {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-4 group ${className}`}
    >
      <div className="flex items-start gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 border border-slate-800 shadow-xs">
          {logoUrl ? (
            <img src={logoUrl} alt={name} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors truncate">
              {name}
            </h3>
            {verified && (
              <span title="Verified Employer" className="text-blue-600 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{industry}</span>
          </p>

          <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{location}</span>
          </p>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/60">
          <Briefcase className="w-3.5 h-3.5" />
          <span>{openJobsCount} open {openJobsCount === 1 ? "role" : "roles"}</span>
        </span>

        <Link
          to="/app/jobs"
          search={{ search: name } as any}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors"
        >
          <span>Explore</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};
