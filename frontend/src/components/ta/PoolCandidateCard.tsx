import React from "react";
import { PoolMatchNotes, PoolMatchScore } from "./PoolMatchDetails";
import { formatDate, cn } from "../../lib/utils";
import { SelectBox } from "../common/SelectBox";
import type { TalentPoolMatchResult } from "../../lib/types/ta.types";

const AVAILABILITY_LABELS: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "text-emerald-800" },
  UNAVAILABLE: { label: "Unavailable", className: "text-slate-700" },
  UNKNOWN: { label: "Availability not confirmed", className: "text-amber-800" },
};

/** Availability as plain text: "Available", "Unavailable" or "Availability not confirmed". */
export const AvailabilityText: React.FC<{ availability?: string | null; className?: string }> = ({ availability, className }) => {
  const meta = AVAILABILITY_LABELS[String(availability || "UNKNOWN")] ?? AVAILABILITY_LABELS.UNKNOWN;
  return <span className={cn("font-medium", meta.className, className)}>{meta.label}</span>;
};

export interface PoolCandidateCardProps {
  result: TalentPoolMatchResult;
  /** Buttons or status text shown in the footer. */
  actions: React.ReactNode;
  maxSkills?: number;
  className?: string;
  /** Adds a checkbox for bulk actions. Omit it and the card looks as before. */
  selectable?: { checked: boolean; disabled?: boolean; onChange: () => void };
}

/** One candidate pool member. Shared by the Candidate pool page and the job opening's pool tab. */
export const PoolCandidateCard: React.FC<PoolCandidateCardProps> = ({ result, actions, maxSkills = 6, className, selectable }) => {
  const c = result.candidate;
  const place = [c.city, c.province].filter(Boolean).join(", ");
  const details = [c.currentRole, place].filter(Boolean).join(" · ");

  return (
    <article className={cn("flex flex-col justify-between gap-3 border border-slate-300 bg-white p-4", className)}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          {selectable && (
            <div className="-ml-1 -mt-1 shrink-0">
              <SelectBox
                checked={selectable.checked}
                disabled={selectable.disabled}
                label={`Select ${c.firstName} ${c.lastName}`}
                onChange={selectable.onChange}
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-slate-900">
              {c.firstName} {c.lastName}
            </h4>
            <p className="break-all text-sm text-slate-600">{c.email || "No email"}</p>
            <p className="text-sm">
              <AvailabilityText availability={c.availability} />
            </p>
          </div>
          <PoolMatchScore result={result} />
        </div>

        {details && <p className="text-sm text-slate-700">{details}</p>}

        <PoolMatchNotes result={result} />

        {c.skills && c.skills.length > 0 && (
          <ul className="flex flex-wrap gap-1 pt-1" aria-label="Skills">
            {c.skills.slice(0, maxSkills).map((s: any, idx) => (
              <li key={idx} className="bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {typeof s === "string" ? s : s.name}
              </li>
            ))}
          </ul>
        )}

        {c.lastContactedAt && <p className="text-xs text-slate-600">Last contacted {formatDate(c.lastContactedAt)}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">{actions}</div>
    </article>
  );
};
