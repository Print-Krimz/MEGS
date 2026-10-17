import React from "react";
import { Check, X } from "lucide-react";
import type { DimensionExplanation, DimensionStatus } from "../../lib/types/ta.types";

interface ScoreReasonsProps {
  statuses?: Record<string, string>;
  explanations?: Record<string, DimensionExplanation>;
}

const LABELS: Record<string, string> = {
  SKILLS: "Skills",
  EXPERIENCE: "Experience",
  LOCATION: "Location",
  EDUCATION_CERTIFICATIONS: "Education / certificates",
};

const formatYears = (years: number) => `${years} ${years === 1 ? "year" : "years"}`;

const TermList: React.FC<{ found: boolean; terms: string[] }> = ({ found, terms }) => (
  <p className="flex items-start gap-1.5">
    {found ? (
      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
    ) : (
      <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-700" aria-hidden="true" />
    )}
    <span>
      <span className="font-medium text-slate-800">{found ? "Found:" : "Not found:"}</span> {terms.join(", ")}
    </span>
  </p>
);

/**
 * Why each dimension of the match score came out as it did: required items found or not
 * found in the profile, years, and the place that matched. Scores from before these
 * details were recorded show nothing.
 */
export const ScoreReasons: React.FC<ScoreReasonsProps> = ({ statuses, explanations }) => {
  if (!explanations) return null;

  const rows = Object.keys(LABELS).flatMap((key) => {
    const detail = explanations[key];
    const status = statuses?.[key] as DimensionStatus | undefined;
    if (!detail || (status !== "EVALUATED" && status !== "NEEDS_REVIEW")) return [];

    const lines: React.ReactNode[] = [];
    if (detail.matched?.length) lines.push(<TermList key="found" found terms={detail.matched} />);
    if (detail.missing?.length) lines.push(<TermList key="missing" found={false} terms={detail.missing} />);
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

  return (
    <div className="border border-slate-200 rounded-md bg-white">
      <h4 className="px-3 pt-3 text-xs font-semibold text-slate-900">Why these scores</h4>
      <dl className="divide-y divide-slate-100 text-xs text-slate-600">
        {rows.map((row) => (
          <div key={row.key} className="px-3 py-2 grid gap-1 sm:grid-cols-[10rem_1fr]">
            <dt className="font-medium text-slate-700">{LABELS[row.key]}</dt>
            <dd className="space-y-0.5 min-w-0 break-words">{row.lines}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
