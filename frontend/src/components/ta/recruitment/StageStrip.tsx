import React, { useRef } from "react";
import { cn } from "../../../lib/utils";
import { useScrollFade } from "../../common/Tabs";

export interface StageStripItem {
  /** Filter value. An empty string means "All". */
  value: string;
  label: string;
  count?: number;
}

interface StageStripProps {
  items: StageStripItem[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Stage filter shown as a scrolling strip with counts. Buttons toggle a filter, so they use
 * aria-pressed rather than the tab role (the table below is not a tab panel).
 */
export const StageStrip: React.FC<StageStripProps> = ({ items, value, onChange, ariaLabel, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const fade = useScrollFade(ref, [items.length]);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={ariaLabel}
      style={fade}
      className={cn(
        "flex flex-nowrap items-stretch overflow-x-auto overscroll-x-contain rounded-md border border-slate-300 bg-white [scrollbar-width:thin]",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value || "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy",
              selected
                ? "border-navy bg-navy-soft font-semibold text-navy"
                : "border-transparent font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950",
            )}
          >
            <span>{item.label}</span>
            {item.count !== undefined && " "}
            {item.count !== undefined && (
              <span className={cn("text-xs tabular-nums", selected ? "text-navy" : "text-slate-500")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** The recruiter-facing stages shown as strip items, in pipeline order. */
export const STAGE_STRIP_STAGES = [
  "SUBMITTED",
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
] as const;

/** Every status a list row can hold, in pipeline order. Statuses outside the core strip show only while they hold rows. */
const ALL_STRIP_STATUSES = [
  "SUBMITTED",
  "PARSING",
  "REVIEW",
  "NEEDS_ATTENTION",
  "MATCHED",
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "HIRED",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
  "TALENT_POOL",
  "BACKOUT",
  "REJECTED",
] as const;

/**
 * Stages to show: the core ones always, plus any other status that has rows, so the tabs add up to "All".
 * The selected status stays even at zero so an applied filter never vanishes.
 */
export const stripStages = (byStatus: Partial<Record<string, number>>, current: string | undefined, openOnly: boolean): string[] => {
  const core = new Set<string>(STAGE_STRIP_STAGES);
  const stages = ALL_STRIP_STATUSES.filter((stage) => core.has(stage) || (byStatus[stage] ?? 0) > 0 || stage === current);
  const shown: string[] = openOnly ? stages.filter((stage) => stage !== "DEPLOYED" || stage === current) : [...stages];
  if (current && !shown.includes(current)) shown.push(current);
  return shown;
};
