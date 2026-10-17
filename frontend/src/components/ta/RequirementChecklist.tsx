import React from "react";
import { Check, CircleDashed, HelpCircle, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type RequirementResult = "MET" | "PARTIAL" | "NOT_MET" | "UNCLEAR";

export interface RequirementCheck {
  requirement: string;
  result: RequirementResult;
  evidence: string;
}

const RESULT_META: Record<RequirementResult, { label: string; icon: React.ElementType; className: string }> = {
  MET: { label: "Met", icon: Check, className: "text-emerald-800 bg-emerald-50 border-emerald-300" },
  PARTIAL: { label: "Partly met", icon: CircleDashed, className: "text-amber-800 bg-amber-50 border-amber-300" },
  NOT_MET: { label: "Not met", icon: X, className: "text-rose-800 bg-rose-50 border-rose-300" },
  UNCLEAR: { label: "Not mentioned", icon: HelpCircle, className: "text-slate-700 bg-slate-50 border-slate-300" },
};

const RESULTS = Object.keys(RESULT_META) as RequirementResult[];

// Items TA should raise with the candidate, most serious first.
const CHECK_ORDER: RequirementResult[] = ["NOT_MET", "PARTIAL", "UNCLEAR"];

/** Keeps only well-formed entries from the stored AI assessment JSON. */
export const parseRequirementChecks = (value: unknown): RequirementCheck[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is RequirementCheck =>
          !!item &&
          typeof item.requirement === "string" &&
          typeof item.evidence === "string" &&
          RESULTS.includes(item.result)
      )
    : [];

const RequirementRow: React.FC<{ check: RequirementCheck }> = ({ check }) => {
  const meta = RESULT_META[check.result];
  const Icon = meta.icon;
  return (
    <li className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-start sm:gap-3">
      <span
        className={cn(
          "inline-flex w-fit shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold sm:w-28",
          meta.className
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-semibold text-slate-900 break-words">{check.requirement}</p>
        {check.evidence && <p className="text-xs text-slate-600 leading-snug break-words">{check.evidence}</p>}
      </div>
    </li>
  );
};

const RequirementGroup: React.FC<{ title: string; checks: RequirementCheck[] }> = ({ title, checks }) =>
  checks.length === 0 ? null : (
    <div className="space-y-1.5">
      <h5 className="text-xs font-semibold text-slate-700">
        {title} <span className="font-normal text-slate-500 tabular-nums">({checks.length})</span>
      </h5>
      <ul className="divide-y divide-slate-200 border border-slate-300 rounded-md">
        {checks.map((check, i) => (
          <RequirementRow key={i} check={check} />
        ))}
      </ul>
    </div>
  );

/**
 * Job requirements grouped by what TA should do next: items to check with the
 * candidate first, then the ones the resume already shows.
 */
export const RequirementChecklist: React.FC<{ checks: RequirementCheck[] }> = ({ checks }) => {
  const toCheck = CHECK_ORDER.flatMap((result) => checks.filter((check) => check.result === result));
  const met = checks.filter((check) => check.result === "MET");

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Job requirements</h4>
        <p className="text-xs text-slate-700">
          <span className="font-semibold tabular-nums">{met.length}</span> of{" "}
          <span className="tabular-nums">{checks.length}</span> met
        </p>
      </div>
      <RequirementGroup title="Check with candidate" checks={toCheck} />
      <RequirementGroup title="Met" checks={met} />
    </div>
  );
};
