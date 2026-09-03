import React from "react";
import { computeProfileHealth } from "../../lib/profile-health";
import type { ApplicantProfile } from "../../lib/types/applicant.types";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

interface ProfileHealthMeterProps {
  profile?: ApplicantProfile | null;
  onJumpToTab?: (tab: string) => void;
}

export const ProfileHealthMeter: React.FC<ProfileHealthMeterProps> = ({
  profile,
  onJumpToTab,
}) => {
  const health = computeProfileHealth(profile);

  return (
    <div className="bg-white border border-slate-200 p-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
              Profile Strength:
            </span>
            <span className="text-xs font-bold font-sans text-teal-700">
              {health.score}%
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-mono font-bold uppercase text-slate-700">
              {health.tier}
            </span>
          </div>
        </div>

        {health.missingItems.length > 0 && onJumpToTab && (
          <button
            type="button"
            onClick={() => {
              const firstMissing = health.missingItems[0].toLowerCase();
              if (firstMissing.includes("personal")) onJumpToTab("personal");
              else if (firstMissing.includes("resume")) onJumpToTab("documents");
              else if (firstMissing.includes("experience")) onJumpToTab("experience");
              else if (firstMissing.includes("education")) onJumpToTab("education");
              else if (firstMissing.includes("skill")) onJumpToTab("skills");
              else if (firstMissing.includes("reference")) onJumpToTab("references");
              else onJumpToTab("personal");
            }}
            className="inline-flex items-center gap-1.5 min-h-11 px-2.5 py-1 text-xs font-medium text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
          >
            <span>Complete Next Section</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="pt-3 space-y-2">
        <div className="w-full bg-slate-100 h-2 border border-slate-200 overflow-hidden">
          <div
            className="h-full bg-teal-600 transition-all duration-300"
            style={{ width: `${health.score}%` }}
            role="progressbar"
            aria-valuenow={health.score}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            {health.score >= 85 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            )}
            <span>{health.nextActionTip}</span>
          </div>
          <span className="font-mono text-slate-400 hidden md:inline">
            {health.score >= 85 ? "Verified for Placement" : `${100 - health.score}% to 100%`}
          </span>
        </div>
      </div>
    </div>
  );
};
