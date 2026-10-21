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
