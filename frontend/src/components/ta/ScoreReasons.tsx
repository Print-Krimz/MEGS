import React, { useState } from "react";
import { Check, Minus, X } from "lucide-react";
import type { DimensionExplanation, DimensionStatus } from "../../lib/types/ta.types";

interface ScoreReasonsProps {
  statuses?: Record<string, string>;
  explanations?: Record<string, DimensionExplanation>;
  /** Percent score per dimension key. Used to put the weakest reasons first. */
  scores?: Record<string, number | null | undefined>;
  /** How many reasons show before "Show all". Default 3. */
  collapsedCount?: number;
}

const LABELS: Record<string, string> = {
  SKILLS: "Skills",
  EXPERIENCE: "Experience",
  LOCATION: "Location",
  EDUCATION_CERTIFICATIONS: "Education / certificates",
};

const formatYears = (years: number) => `${years} ${years === 1 ? "year" : "years"}`;

const TermList: React.FC<{ found: boolean; terms: string[]; preferred?: boolean }> = ({ found, terms, preferred }) => (
  <p className="flex items-start gap-1.5">
    {found ? (
      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
    ) : preferred ? (
      <Minus className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
    ) : (
      <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-700" aria-hidden="true" />
    )}
    <span>
      <span className="font-medium text-slate-800">{found ? "Found:" : preferred ? "Preferred, not found:" : "Not found:"}</span>{" "}
      {terms.join(", ")}
    </span>
  </p>
);

/**
 * Why each dimension of the match score came out as it did: required items found or not
 * found in the profile, years, and the place that matched. Scores from before these
 * details were recorded show nothing.
 */
export const ScoreReasons: React.FC<ScoreReasonsProps> = ({ statuses, explanations, scores, collapsedCount = 3 }) => {
  const [showAll, setShowAll] = useState(false);
  if (!explanations) return null;

  const rows = Object.keys(LABELS).flatMap((key) => {
    const detail = explanations[key];
    const status = statuses?.[key] as DimensionStatus | undefined;
    if (!detail || (status !== "EVALUATED" && status !== "NEEDS_REVIEW")) return [];

    const lines: React.ReactNode[] = [];
    if (detail.matched?.length) lines.push(<TermList key="found" found terms={detail.matched} />);
    if (detail.missing?.length) lines.push(<TermList key="missing" found={false} terms={detail.missing} />);
    if (detail.preferredMissing?.length) lines.push(<TermList key="preferred" found={false} preferred terms={detail.preferredMissing} />);
    if (key === "EXPERIENCE" && typeof detail.requiredYears === "number" && typeof detail.candidateYears === "number") {
      lines.push(
        <p key="years">
          {formatYears(detail.candidateYears)} of work history; the job asks for {formatYears(detail.requiredYears)}.
        </p>
      );
    }
    if (key === "LOCATION" && "locationMatchedOn" in detail) {
      lines.push(
        <p key="place">
          {detail.locationMatchedOn ? `Lives in or prefers ${detail.locationMatchedOn}.` : "Lives outside the job location."}
        </p>
      );
    }
    return lines.length ? [{ key, lines }] : [];
  });

  if (!rows.length) return null;

  // Weakest dimensions first: the reasons that cost the candidate points are what a recruiter checks.
  const score = (key: string) => {
    const value = scores?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 101;
  };
  const ordered = [...rows].sort((a, b) => score(a.key) - score(b.key));
  const hidden = Math.max(0, ordered.length - collapsedCount);
  const visible = showAll ? ordered : ordered.slice(0, collapsedCount);

  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <h4 className="px-3 pt-3 text-sm font-semibold text-slate-900">Why these scores</h4>
      <dl className="divide-y divide-slate-100 text-sm text-slate-700">
        {visible.map((row) => (
          <div key={row.key} className="px-3 py-2 grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-slate-700">{LABELS[row.key]}</dt>
            <dd className="space-y-0.5 min-w-0 break-words">{row.lines}</dd>
          </div>
        ))}
      </dl>
      {hidden > 0 && (
        <div className="border-t border-slate-100 px-3">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="focus-ring inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-9"
          >
            {showAll ? "Show fewer" : `Show all (${ordered.length})`}
          </button>
        </div>
      )}
    </div>
  );
};
