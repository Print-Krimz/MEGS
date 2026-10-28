import React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Trend, TrendPoint } from "../../../lib/types/analytics.types";
import { CHART_AXIS_TEXT, CHART_GRID, TEXT_LOSS, TREND } from "../../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { FIRST_LOAD_MS, REPORT_EASE } from "./motion";
import { ChartLegend, DataTableToggle } from "./chart-primitives";

interface PlacementTrendChartProps {
  trend: Trend;
  rangeLabel: string;
}

const W = 640;
const H = 180;
const PAD = { top: 10, right: 8, bottom: 24, left: 28 };
const NICE = [4, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

const niceMax = (v: number) => NICE.find((n) => n >= v) ?? Math.ceil(v / 1000) * 1000;

const GRANULARITY_PREFIX = { day: "", week: "Week of ", month: "" } as const;

const SERIES = {
  started: { label: "Started", fill: TREND.newStarts },
  left: { label: "Left", fill: TREND.backouts },
} as const;

/** A column that grows up from the baseline on first load. */
const Column: React.FC<{ x: number; y: number; width: number; height: number; fill: string; index: number }> = ({ x, y, width, height, fill, index }) => {
  const reduce = useReducedMotion();
  if (height <= 0) return null;
  return (
    <motion.rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      style={{ transformBox: "fill-box", transformOrigin: "center bottom" }}
      initial={reduce ? false : { scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: FIRST_LOAD_MS / 1000, ease: REPORT_EASE, delay: Math.min(index, 12) * 0.03 }}
    />
  );
};

const bucketText = (p: TrendPoint, prefix: string): string => {
  const started = p.newStarts + p.redeployStarts;
  const left = p.backouts + p.withdrawals;
  const part = (items: [number, string][]) => items.filter(([n]) => n > 0).map(([n, l]) => `${n} ${l}`).join(", ");
  const group = (n: number, word: string, items: [number, string][]) => (n > 0 ? `${n} ${word} (${part(items)})` : `0 ${word}`);
  return `${prefix}${p.label}: ${group(started, "started", [[p.newStarts, "new"], [p.redeployStarts, "redeployed"]])}, ${group(left, "left", [[p.backouts, "backed out"], [p.withdrawals, "withdrew"]])}`;
};

/**
 * Two columns per day, week or month on one baseline: people who started (new and redeployed) and people who left
 * (backed out and withdrew). The breakdown is in each column pair's tooltip and in the table.
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

  const top = Math.max(0, ...points.map((p) => p.newStarts + p.redeployStarts));
  const bottom = Math.max(0, ...points.map((p) => p.backouts + p.withdrawals));
  const max = niceMax(Math.max(top, bottom, 1));
  const innerH = H - PAD.top - PAD.bottom;
  const base = PAD.top + innerH;
  const h = (v: number) => (v > 0 ? Math.max(2, (v / max) * innerH) : 0);
  const ticks = max % 2 === 0 ? [0, max / 2, max] : [0, max];

  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(18, slot / 2 - 3));

  const labelW = Math.max(...points.map((p) => p.label.length), 1) * 6.5 + 10;
  const every = Math.max(1, Math.ceil(labelW / slot));
  const last = points.length - 1;
  const showLabel = (i: number) => i === last || (i % every === 0 && (last - i >= every));

  return (
    <AnalyticsPanel
      id="trend"
      title="Starts and people who left"
      subtitle={`${granularity === "day" ? "Daily" : granularity === "week" ? "Weekly" : "Monthly"}, ${rangeLabel}. Left means backed out after client review or withdrew before it. Hover a pair for the breakdown.`}
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
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full min-w-[26rem] h-auto"
              role="group"
              aria-label={`${starts} starts, ${redeployments} of them redeployments, ${backouts} backouts after client review and ${withdrawals} withdrawals before client review in ${rangeLabel}. The table under the chart gives each ${granularity}.`}
            >
              {ticks.map((t) => {
                const y = base - (t / max) * innerH;
                return (
                  <g key={t}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={t === 0 ? CHART_AXIS_TEXT : CHART_GRID} strokeWidth="1" />
                    <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="12" fill={CHART_AXIS_TEXT} className="tabular-nums">
                      {t}
                    </text>
                  </g>
                );
              })}
              {points.map((p, i) => {
                const cx = PAD.left + slot * i + slot / 2;
                const startTotal = p.newStarts + p.redeployStarts;
                const leftTotal = p.backouts + p.withdrawals;
                const hasData = startTotal + leftTotal > 0;
                const text = bucketText(p, prefix);
                return (
                  <g key={p.start}>
                    <Column index={i} x={cx - barW - 1} y={base - h(startTotal)} width={barW} height={h(startTotal)} fill={SERIES.started.fill} />
                    <Column index={i} x={cx + 1} y={base - h(leftTotal)} width={barW} height={h(leftTotal)} fill={SERIES.left.fill} />
                    {hasData && (
                      <rect
                        x={PAD.left + slot * i}
                        y={PAD.top}
                        width={slot}
                        height={innerH}
                        fill="transparent"
                        role="img"
                        aria-label={text}
                        tabIndex={0}
                        className="focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-700"
                      >
                        <title>{text}</title>
                      </rect>
                    )}
                    {showLabel(i) && (
                      <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill={CHART_AXIS_TEXT}>
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
            columns={["Period", "New", "Redeployed", "Backed out", "Withdrew"]}
            rows={points.map((p) => ({ key: p.start, cells: [p.label, p.newStarts, p.redeployStarts, p.backouts, p.withdrawals] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
