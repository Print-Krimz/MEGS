import { HEALTH_CHIP } from "../../../lib/chart-palette";
import React from "react";

export interface AttentionItem {
  id: string;
  label: string;
  /** Wording for a count of exactly one, when it is not just the plural minus an s. */
  singular?: string;
  count: number;
  /** Section id to scroll to. */
  target: string;
  tone: "alert" | "warn";
  /** Runs before scrolling, e.g. to open a tab and apply a filter. */
  onSelect?: () => void;
}

interface AttentionStripProps {
  items: AttentionItem[];
}

const TONE = {
  alert: `${HEALTH_CHIP.overdue.className} hover:bg-[#FBE3E6]`,
  warn: `${HEALTH_CHIP.watch.className} hover:bg-navy-soft`,
} as const;

/** The few things a team leader should look at first. Each one scrolls to the section that lists the records. */
export const AttentionStrip: React.FC<AttentionStripProps> = ({ items }) => {
  const shown = items.filter((i) => i.count > 0);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Needs attention" className="border border-navy-line bg-white rounded-md px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-700">Needs attention</span>
        {shown.map((item) => (
          <a
            key={item.id}
            href={`#${item.target}`}
            onClick={(event) => {
              event.preventDefault();
              item.onSelect?.();
              // Let a newly opened tab render before scrolling to it.
              setTimeout(() => document.getElementById(item.target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
            className={`min-h-11 md:min-h-9 inline-flex items-center gap-1.5 border px-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${TONE[item.tone]}`}
          >
            <span className="tabular-nums text-sm">{item.count}</span>
            {item.count === 1 ? item.singular ?? item.label : item.label}
          </a>
        ))}
      </div>
    </section>
  );
};
