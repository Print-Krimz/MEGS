import React from "react";
import type { Trend } from "../../lib/types/analytics.types";
import { CHART_AXIS_TEXT, CHART_GRID, TEXT_LOSS, TREND } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ChartLegend, DataTableToggle } from "./chart-primitives";

interface PlacementTrendChartProps {
  trend: Trend;
  rangeLabel: string;
}

const W = 640;
const H = 150;
const PAD = { top: 14, right: 8, bottom: 26, left: 28 };

const SERIES = {
  newStarts: { label: "New starts", fill: TREND.newStarts },
  redeployStarts: { label: "Redeployments", fill: TREND.redeployStarts },
  backouts: { label: "Backed out after client review", fill: TREND.backouts },
  withdrawals: { label: "Withdrew before client review", fill: TREND.withdrawals },
} as const;

const GRANULARITY_TEXT = {
  day: "By day.",
  week: "By week, Monday to Sunday.",
  month: "By month.",
} as const;

/**
 * Starts (new and redeployment) stacked next to people who left (backed out or withdrew), one pair of columns
 * per day, week or month depending on the selected range.
 */
export const PlacementTrendChart: React.FC<PlacementTrendChartProps> = ({ trend, rangeLabel }) => {
  const { points, granularity } = trend;
  const starts = points.reduce((s, p) => s + p.newStarts + p.redeployStarts, 0);
  const redeployments = points.reduce((s, p) => s + p.redeployStarts, 0);
  const backouts = points.reduce((s, p) => s + p.backouts, 0);
  const withdrawals = points.reduce((s, p) => s + p.withdrawals, 0);
  const totals = { newStarts: starts - redeployments, redeployStarts: redeployments, backouts, withdrawals };
  const isEmpty = starts + backouts + withdrawals === 0;

  const max = Math.max(4, ...points.flatMap((p) => [p.newStarts + p.redeployStarts, p.backouts + p.withdrawals]));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(16, slot / 2 - 2));
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const base = PAD.top + innerH;
  const ticks = [0, Math.ceil(max / 2), max];
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <AnalyticsPanel
      id="trend"
      title="Starts and people who left"
      subtitle={`${GRANULARITY_TEXT[granularity]} Starts use the actual start date. Covers ${rangeLabel}. Left of each pair of columns: starts. Right: people who left.`}
      aside={
        <span>
          <span className="font-bold text-slate-950 tabular-nums">{starts}</span> started ·{" "}
          <span className={`font-bold ${TEXT_LOSS} tabular-nums`}>{backouts + withdrawals}</span> left
        </span>
      }
    >
      {isEmpty ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">No starts, backouts or withdrawals in this period.</p>
      ) : (
        <div className="p-3.5">
          <ChartLegend
            className="mb-2"
            items={(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key) => ({ key, label: SERIES[key].label, color: SERIES[key].fill, value: totals[key] }))}
          />
          <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[26rem] h-auto"
            role="img"
            aria-label={`${starts} starts, ${redeployments} of them redeployments, ${backouts} backouts after client review and ${withdrawals} withdrawals before client review in ${rangeLabel}. The table under the chart gives each ${granularity}.`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={CHART_GRID} strokeWidth="1" />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="11" fill={CHART_AXIS_TEXT} className="tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {points.map((p, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const startTotal = p.newStarts + p.redeployStarts;
              const leftTotal = p.backouts + p.withdrawals;
              return (
                <g key={p.start}>
                  <title>
                    {`${p.label}: ${p.newStarts} new starts, ${p.redeployStarts} redeployments, ${p.backouts} backed out after client review, ${p.withdrawals} withdrew before client review`}
                  </title>
                  <rect x={cx - barW - 1} y={y(p.newStarts)} width={barW} height={base - y(p.newStarts)} fill={SERIES.newStarts.fill} />
                  <rect
                    x={cx - barW - 1}
                    y={y(startTotal)}
                    width={barW}
                    height={y(p.newStarts) - y(startTotal)}
                    fill={SERIES.redeployStarts.fill}
                  />
                  <rect x={cx + 1} y={y(p.backouts)} width={barW} height={base - y(p.backouts)} fill={SERIES.backouts.fill} />
                  <rect x={cx + 1} y={y(leftTotal)} width={barW} height={y(p.backouts) - y(leftTotal)} fill={SERIES.withdrawals.fill} />
                  {i % labelEvery === 0 && (
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill={CHART_AXIS_TEXT}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          </div>
          <DataTableToggle
            caption={`Starts and people who left, by ${granularity}`}
            columns={["Period", "New starts", "Redeployments", "Backed out after client review", "Withdrew before client review"]}
            rows={points.map((p) => ({ key: p.start, cells: [p.label, p.newStarts, p.redeployStarts, p.backouts, p.withdrawals] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
