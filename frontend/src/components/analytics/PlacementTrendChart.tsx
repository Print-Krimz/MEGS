import React from "react";
import type { Trend } from "../../lib/types/analytics.types";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface PlacementTrendChartProps {
  trend: Trend;
  rangeLabel: string;
}

const W = 640;
const H = 150;
const PAD = { top: 14, right: 8, bottom: 26, left: 28 };

const SERIES = {
  newStarts: { label: "New starts", fill: "#0d9488", swatch: "bg-teal-600" },
  redeployStarts: { label: "Redeployments", fill: "#0284c7", swatch: "bg-sky-600" },
  backouts: { label: "Backed out after client review", fill: "#e11d48", swatch: "bg-rose-600" },
  withdrawals: { label: "Withdrew before client review", fill: "#f59e0b", swatch: "bg-amber-500" },
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
          <span className="font-bold text-rose-700 tabular-nums">{backouts + withdrawals}</span> left
        </span>
      }
    >
      {isEmpty ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">No starts, backouts or withdrawals in this period.</p>
      ) : (
        <div className="p-3.5">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700" aria-label="Legend">
            {(Object.keys(SERIES) as (keyof typeof SERIES)[]).map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 ${SERIES[key].swatch}`} aria-hidden="true" />
                {SERIES[key].label}
              </li>
            ))}
          </ul>
          <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[26rem] h-auto"
            role="img"
            aria-label={`${starts} starts, ${redeployments} of them redeployments, ${backouts} backouts after client review and ${withdrawals} withdrawals before client review in ${rangeLabel}. The table below gives each ${granularity}.`}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="11" fill="#64748b" className="tabular-nums">
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
                    <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">
                      {p.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          </div>
          {/* A table ignores the 1px sr-only width, so the clipping lives on a wrapper. */}
          <div className="sr-only">
            <table>
              <caption>Starts and people who left, by {granularity}</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">New starts</th>
                  <th scope="col">Redeployments</th>
                  <th scope="col">Backed out after client review</th>
                  <th scope="col">Withdrew before client review</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.start}>
                    <th scope="row">{p.label}</th>
                    <td>{p.newStarts}</td>
                    <td>{p.redeployStarts}</td>
                    <td>{p.backouts}</td>
                    <td>{p.withdrawals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AnalyticsPanel>
  );
};
