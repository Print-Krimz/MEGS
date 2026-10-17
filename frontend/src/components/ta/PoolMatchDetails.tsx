import React from "react";
import { Link } from "@tanstack/react-router";
import { Clock, X } from "lucide-react";
import { ScoreBadge } from "../common/ScoreBadge";
import { getApplicationStatusPresentation } from "../../lib/utils";
import type { TalentPoolMatchResult } from "../../lib/types/ta.types";

/** Match score (job searches) or profile similarity (word and similar-candidate searches). */
export const PoolMatchScore: React.FC<{ result: TalentPoolMatchResult }> = ({ result }) => {
  if (typeof result.matchScore === "number") {
    return (
      <div className="text-right">
        <div className="text-[10px] text-slate-500">Match score</div>
        <ScoreBadge score={result.matchScore} size="md" />
      </div>
    );
  }
  return (
    <span className="text-xs text-slate-600 tabular-nums">
      {Math.round((result.similarity || 0) * 100)}% similar profile
    </span>
  );
};

/** What the profile lacks for this job, and other jobs the person is being processed for. */
export const PoolMatchNotes: React.FC<{ result: TalentPoolMatchResult }> = ({ result }) => {
  const missing = result.missingRequired ?? [];
  const inProcess = result.inProcessFor ?? [];
  if (!missing.length && !inProcess.length) return null;

  return (
    <div className="space-y-1 text-xs text-slate-600">
      {missing.length > 0 && (
        <p className="flex items-start gap-1.5">
          <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-700" aria-hidden="true" />
          <span>
            <span className="font-medium text-slate-800">Missing:</span> {missing.join(", ")}
          </span>
        </p>
      )}
      {inProcess.map((application) => (
        <p key={application.applicationId} className="flex items-start gap-1.5">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            In process for{" "}
            <Link
              to="/ta/applications/$applicationId"
              params={{ applicationId: String(application.applicationId) }}
              className="text-teal-800 underline underline-offset-2"
            >
              {application.jobTitle || `job #${application.jobId}`}
            </Link>{" "}
            ({getApplicationStatusPresentation(application.status).label.toLowerCase()})
          </span>
        </p>
      ))}
    </div>
  );
};
