import React from "react";
import type { DropOffRow } from "../../lib/types/analytics.types";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface DropOffChartProps {
  rows: DropOffRow[];
  rangeLabel: string;
}

const SEGMENTS = [
  { key: "movedForward", label: "Moved on", className: "bg-teal-600" },
  { key: "inStage", label: "Waiting", className: "bg-slate-400" },
  { key: "backedOut", label: "Backed out", className: "bg-rose-600" },
  { key: "rejected", label: "Not selected", className: "bg-amber-500" },
] as const;

/** One bar per stage, scaled to everyone who applied, split by what happened to those who reached it. */
export const DropOffChart: React.FC<DropOffChartProps> = ({ rows, rangeLabel }) => {
  const total = rows[0]?.reached ?? 0;

  return (
    <AnalyticsPanel
      title="What happens at each stage"
      subtitle={`Applicants who applied ${rangeLabel}. Returning applicants count once.`}
    >
      <div className="p-3.5 space-y-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700" aria-label="Legend">
          {SEGMENTS.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 ${s.className}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>

        {total === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 font-sans">No applications were received in this period.</p>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((row, index) => {
              const width = (row.reached / total) * 100;
              const previous = index > 0 ? rows[index - 1] : null;
              const conversion = previous && previous.reached > 0 ? Math.round((row.reached / previous.reached) * 100) : null;
              const summary = `${row.label}: ${row.reached} reached${conversion === null ? "" : `, ${conversion}% of those who reached ${previous!.label}`}. ${row.movedForward} moved on, ${row.inStage} waiting, ${row.backedOut} backed out, ${row.rejected} not selected.`;
              return (
                <li key={row.stage} aria-label={summary}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="font-sans font-medium text-slate-900">{row.label}</span>
                    <span className="font-sans tabular-nums text-slate-700">
                      <strong>{row.reached}</strong> reached
                      {conversion !== null && <span className="text-slate-600"> ({conversion}% of {previous!.label.toLowerCase()})</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-3.5 bg-slate-100">
                    <div className="flex h-full" style={{ width: `${width}%` }} title={summary}>
                      {SEGMENTS.map((s) => {
                        const count = row[s.key];
                        return count > 0 ? (
                          <div key={s.key} className={s.className} style={{ width: `${(count / row.reached) * 100}%` }} />
                        ) : null;
                      })}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 font-sans tabular-nums">
                    {row.movedForward} moved on · {row.inStage} waiting · {row.rejected} not selected
                    {row.backedOut > 0 && <span className="text-rose-700"> · {row.backedOut} backed out</span>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </AnalyticsPanel>
  );
};
