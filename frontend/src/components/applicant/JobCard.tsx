import React from "react";
import { Link } from "@tanstack/react-router";
import {
  MapPin,
  Building2,
  Bookmark,
  Briefcase,
  Calendar,
  CheckCircle2,
  Banknote,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatRelativeTime } from "../../lib/utils";

export interface JobCardProps {
  id: number;
  title: string;
  company?: string;
  companyVerified?: boolean;
  location?: string;
  workSetup?: "ON_SITE" | "HYBRID" | "REMOTE" | string;
  salaryRange?: string;
  employmentType?: string;
  description?: string;
  requirements?: string;
  skills?: string[];
  createdAt: string;
  status?: string;
  isSaved?: boolean;
  alreadyApplied?: boolean;
  onToggleSave?: (id: number) => void;
  onApply?: (id: number) => void;
  detailUrl?: string;
  compact?: boolean;
  className?: string;
}

export const JobCard: React.FC<JobCardProps> = ({
  id,
  title,
  company = "MAR Employment (MEGS)",
  companyVerified = true,
  location = "Philippines",
  workSetup,
  salaryRange,
  employmentType = "Full-time",
  description,
  requirements,
  skills = [],
  createdAt,
  status = "OPEN",
  isSaved = false,
  alreadyApplied = false,
  onToggleSave,
  onApply,
  detailUrl,
  compact = false,
  className = "",
}) => {
  const targetUrl = detailUrl || `/app/jobs/${id}`;

  // Parse extracted skills or fallback from requirements string
  const extractedSkills: string[] = React.useMemo(() => {
    if (skills && skills.length > 0) return skills.slice(0, 3);
    if (!requirements) return [];
    return requirements
      .split(/[,•;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 24)
      .slice(0, 3);
  }, [skills, requirements]);

  // Normalize work setup presentation
  const workSetupLabel = React.useMemo(() => {
    if (!workSetup) return null;
    const clean = workSetup.toUpperCase().replace(/[-_]/g, " ");
    if (clean.includes("REMOTE")) return "Remote";
    if (clean.includes("HYBRID")) return "Hybrid";
    if (clean.includes("SITE")) return "On-site";
    return workSetup;
  }, [workSetup]);

  return (
    <div
      data-testid={`job-card-${id}`}
      className={`group relative bg-white border border-slate-200/90 rounded-xl p-5 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between ${
        compact ? "space-y-3 p-4" : "space-y-4"
      } ${className}`}
    >
      {/* Top Header: Title, Company & Save Bookmark */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <Link
              to={targetUrl as any}
              className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-sm"
            >
              {title}
            </Link>

            <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-1 text-slate-700 font-semibold truncate max-w-[200px]">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{company}</span>
              </span>
              {companyVerified && (
                <span
                  title="Verified Employer"
                  className="inline-flex items-center text-blue-600"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              )}
            </div>
          </div>

          {/* Save Bookmark Button */}
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(id);
              }}
              aria-label={isSaved ? `Remove ${title} from saved jobs` : `Save ${title} for later`}
              className={`p-2 rounded-lg border transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isSaved
                  ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                  : "bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />
            </button>
          )}
        </div>

        {/* Metadata Badges: Location, Work Setup, Employment Type, Salary */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{location}</span>
          </span>

          {workSetupLabel && (
            <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
              <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{workSetupLabel}</span>
            </span>
          )}

          {employmentType && (
            <span className="inline-flex items-center text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/80">
              {employmentType}
            </span>
          )}

          {salaryRange ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{salaryRange}</span>
            </span>
          ) : (
            <span className="inline-flex items-center text-slate-500 bg-slate-50/80 px-2 py-1 rounded-md text-[11px]">
              Salary Undisclosed
            </span>
          )}
        </div>

        {/* Short Description */}
        {description && !compact && (
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed pt-1">
            {description}
          </p>
        )}

        {/* Extracted Skill Tags */}
        {extractedSkills.length > 0 && !compact && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {extractedSkills.map((skill, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Posted Date, Applied Badge & Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatRelativeTime(createdAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          {alreadyApplied ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Applied</span>
            </span>
          ) : onApply ? (
            <button
              type="button"
              onClick={() => onApply(id)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 shadow-xs"
            >
              <span>Quick Apply</span>
            </button>
          ) : (
            <Link
              to={targetUrl as any}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 group-hover:translate-x-0.5 transition-transform"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
