import React from "react";
import type { DropOffRow } from "../../lib/types/analytics.types";
import { OUTCOME, TEXT_LOSS } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ChartLegend, DataTableToggle, StackedBar, type BarSegment } from "./chart-primitives";
import { analyticsStageLabel } from "./stage-label";

interface DropOffChartProps {
  rows: DropOffRow[];
  rangeLabel: string;
}

const SEGMENTS = [
  { key: "movedForward", label: "Moved on", color: OUTCOME.movedOn },
  { key: "inStage", label: "Waiting", color: OUTCOME.waiting },
  { key: "backedOut", label: "Backed out", color: OUTCOME.backedOut },
  { key: "rejected", label: "Not selected", color: OUTCOME.notSelected },
] as const;

/** One bar per stage, scaled to everyone who applied, split by what happened to those who reached it. */
export const DropOffChart: React.FC<DropOffChartProps> = ({ rows, rangeLabel }) => {
  const total = rows[0]?.reached ?? 0;

  return (
    <AnalyticsPanel
      title="Stage progress"
      subtitle={`Applied ${rangeLabel}. Returning applicants count once.`}
    >
      <div className="p-3.5 space-y-3">
        <ChartLegend items={SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color }))} />

        {total === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500 font-sans">No applications in this period.</p>
        ) : (
          <>
            <ol className="space-y-2.5">
              {rows.map((row, index) => {
                const previous = index > 0 ? rows[index - 1] : null;
                const conversion = previous && previous.reached > 0 ? Math.round((row.reached / previous.reached) * 100) : null;
                const name = analyticsStageLabel(row.stage, row.label);
                const summary = `${name}: ${row.reached} reached${conversion === null ? "" : `, ${conversion}% of those who reached ${analyticsStageLabel(previous!.stage, previous!.label)}`}. ${row.movedForward} moved on, ${row.inStage} waiting, ${row.backedOut} backed out, ${row.rejected} not selected.`;
                const segments: BarSegment[] = SEGMENTS.map((s) => ({ key: s.key, label: s.label, color: s.color, value: row[s.key] }));
                return (
                  <li key={row.stage} aria-label={summary}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="font-sans font-medium text-slate-900">{name}</span>
                      <span className="font-sans tabular-nums text-slate-700">
                        <strong>{row.reached}</strong> reached
                        {conversion !== null && <span className="text-slate-600"> ({conversion}% of {analyticsStageLabel(previous!.stage, previous!.label).toLowerCase()})</span>}
                      </span>
                    </div>
                    <div className="mt-1" style={{ width: `${(row.reached / total) * 100}%`, minWidth: row.reached > 0 ? 6 : 0 }}>
                      <StackedBar label={name} segments={segments} focusable />
                    </div>
                    <p className="mt-1 text-xs text-slate-600 font-sans tabular-nums">
                      {row.movedForward} moved on · {row.inStage} waiting · {row.rejected} not selected
                      {row.backedOut > 0 && <span className={`font-semibold ${TEXT_LOSS}`}> · {row.backedOut} backed out</span>}
                    </p>
                  </li>
                );
              })}
            </ol>
            <DataTableToggle
              caption={`Stage progress for applicants who applied ${rangeLabel}`}
              columns={["Stage", "Reached", "Moved on", "Waiting", "Not selected", "Backed out"]}
              rows={rows.map((r) => ({
                key: r.stage,
                cells: [analyticsStageLabel(r.stage, r.label), r.reached, r.movedForward, r.inStage, r.rejected, r.backedOut],
              }))}
            />
          </>
        )}
      </div>
    </AnalyticsPanel>
  );
};
