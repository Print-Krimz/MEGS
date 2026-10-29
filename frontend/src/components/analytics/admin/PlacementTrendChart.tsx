import React from "react";
import type { Trend, TrendPoint } from "../../../lib/types/analytics.types";
import { TEXT_LOSS, TREND } from "../../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { BarMark, ChartLegend, DataTableToggle } from "./chart-primitives";

interface PlacementTrendChartProps {
  trend: Trend;
  rangeLabel: string;
}

const GRANULARITY_PREFIX = { day: "", week: "Week of ", month: "" } as const;

const SERIES = {
  started: { label: "Started", fill: TREND.newStarts },
  left: { label: "Left", fill: TREND.backouts },
} as const;

const bucketText = (p: TrendPoint, prefix: string): string => {
  const started = p.newStarts + p.redeployStarts;
  const left = p.backouts + p.withdrawals;
  const part = (items: [number, string][]) => items.filter(([n]) => n > 0).map(([n, l]) => `${n} ${l}`).join(", ");
  const group = (n: number, word: string, items: [number, string][]) => (n > 0 ? `${n} ${word} (${part(items)})` : `0 ${word}`);
  return `${prefix}${p.label}: ${group(started, "started", [[p.newStarts, "new"], [p.redeployStarts, "redeployed"]])}, ${group(left, "left", [[p.backouts, "backed out"], [p.withdrawals, "withdrew"]])}`;
};

/**
 * Two horizontal bars per day, week or month on one shared scale: people who started (new and redeployed) and people
 * who left (backed out and withdrew). The breakdown is in each row's tooltip and in the table.
 */
export const PlacementTrendChart: React.FC<PlacementTrendChartProps> = ({ trend, rangeLabel }) => {
  const { points, granularity } = trend;
  const prefix = GRANULARITY_PREFIX[granularity];
  const redeployments = points.reduce((s, p) => s + p.redeployStarts, 0);
  const starts = points.reduce((s, p) => s + p.newStarts, 0) + redeployments;
  const backouts = points.reduce((s, p) => s + p.backouts, 0);
  const withdrawals = points.reduce((s, p) => s + p.withdrawals, 0);
  const left = backouts + withdrawals;
  const isEmpty = starts + left === 0;

  const max = Math.max(1, ...points.map((p) => Math.max(p.newStarts + p.redeployStarts, p.backouts + p.withdrawals)));

  return (
    <AnalyticsPanel
      id="trend"
      title="Starts and people who left"
      subtitle={`${granularity === "day" ? "Daily" : granularity === "week" ? "Weekly" : "Monthly"}, ${rangeLabel}. Left means backed out after client review or withdrew before it. Hover a row for the breakdown.`}
      className="h-full flex flex-col"
      aside={
        <span className="tabular-nums">
          <span className="font-bold text-slate-950">{starts}</span> started ·{" "}
          <span className={`font-bold ${TEXT_LOSS}`}>{left}</span> left
        </span>
      }
    >
      {isEmpty ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">No starts, backouts or withdrawals in this period.</p>
      ) : (
        <div className="p-3.5 flex-1">
          <ChartLegend
            className="mb-2"
            items={(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key) => ({ key, label: SERIES[key].label, color: SERIES[key].fill }))}
          />
          <ul
            className="max-h-72 divide-y divide-slate-100 overflow-y-auto"
            aria-label={`${starts} starts, ${redeployments} of them redeployments, ${backouts} backouts after client review and ${withdrawals} withdrawals before client review in ${rangeLabel}. The table under the chart gives each ${granularity}.`}
          >
            {points.map((p, i) => {
              const startTotal = p.newStarts + p.redeployStarts;
              const leftTotal = p.backouts + p.withdrawals;
              const text = bucketText(p, prefix);
              return (
                <li key={p.start} title={text} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5 text-xs font-sans">
                  <span className="truncate text-slate-700">{p.label}</span>
                  <div className="flex flex-col gap-1">
                    <BarMark label={`${p.label}, started`} value={startTotal} max={max} pct={`${p.newStarts} new, ${p.redeployStarts} redeployed`} color={SERIES.started.fill} heightClass="h-2" index={i} />
                    <BarMark label={`${p.label}, left`} value={leftTotal} max={max} pct={`${p.backouts} backed out, ${p.withdrawals} withdrew`} color={SERIES.left.fill} heightClass="h-2" index={i} />
                  </div>
                  <span className="whitespace-nowrap text-right tabular-nums text-slate-700">
                    <strong className="text-slate-950">{startTotal}</strong> started
                    <br />
                    <span className={leftTotal > 0 ? `font-semibold ${TEXT_LOSS}` : undefined}>{leftTotal}</span> left
                  </span>
                </li>
              );
            })}
          </ul>
          <DataTableToggle
            caption={`Starts and people who left, by ${granularity}`}
            columns={["Period", "New", "Redeployed", "Backed out", "Withdrew"]}
            rows={points.map((p) => ({ key: p.start, cells: [p.label, p.newStarts, p.redeployStarts, p.backouts, p.withdrawals] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
