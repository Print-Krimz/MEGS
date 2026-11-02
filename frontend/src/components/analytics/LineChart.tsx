import React, { useEffect, useRef, useState } from "react";
import { BAR_PRIMARY, TREND } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { DataTableToggle } from "./chart-primitives";

export interface LineChartPoint {
  label: string;
  values: Record<string, number>;
}

export interface LineChartSeries {
  key: string;
  label: string;
}

interface LineChartProps {
  title: string;
  points: LineChartPoint[];
  /** Two at most. The first is drawn navy, the second red. */
  series: LineChartSeries[];
  /** A caption under the title. */
  subtitle?: string;
  id?: string;
  emptyText?: string;
}

/** Navy for the first series, the loss red for the second. Each line is also named at its last point. */
const SERIES_COLORS = [BAR_PRIMARY, TREND.backouts] as const;

/** Fixed height and real pixel text: only the width follows the container, so the chart is the same height at every screen width. */
const H = 240;
const DEFAULT_W = 640;
const M = { top: 16, right: 16, bottom: 28, left: 36 };
const PLOT_H = H - M.top - M.bottom;

/** Round the top of the scale up to a value that gives whole-number gridlines. */
const niceMax = (max: number): number => {
  if (max <= 4) return Math.max(max, 1);
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  return top % 2 === 0 ? top : top + 1;
};

const summarise = (points: LineChartPoint[], s: LineChartSeries): string => {
  const values = points.map((p) => p.values[s.key] ?? 0);
  const total = values.reduce((a, b) => a + b, 0);
  const peak = Math.max(0, ...values);
  const peakCount = values.filter((v) => v > 0).length;
  const base = `${s.label}: ${total} in total`;
  if (peak === 0 || peakCount < 2) return `${base}.`;
  return `${base}, highest ${peak} on ${points[values.indexOf(peak)].label}.`;
};

/**
 * Hand-built SVG line chart for up to two series over time. Markers appear with three or more points, or when there is only one (a lone point has no line). The legend names each line; a one-sentence summary is for screen readers; exact values are under View as table.
 * Nothing animates, so reduced-motion needs no special case.
 */
export const LineChart: React.FC<LineChartProps> = ({ title, points, series, subtitle, id, emptyText = "Nothing recorded in these dates." }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(DEFAULT_W);
  const shown = series.slice(0, 2);
  const totals = shown.map((s) => points.reduce((sum, p) => sum + (p.values[s.key] ?? 0), 0));
  const isEmpty = points.length === 0 || totals.every((t) => t === 0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setW(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isEmpty]);
  const PLOT_W = Math.max(40, W - M.left - M.right);
  const top = niceMax(Math.max(1, ...points.flatMap((p) => shown.map((s) => p.values[s.key] ?? 0))));
  const x = (i: number) => M.left + (points.length <= 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const y = (v: number) => M.top + PLOT_H - (v / top) * PLOT_H;
  const ticks = top <= 4 ? Array.from({ length: top + 1 }, (_, i) => i) : [0, top / 2, top];

  // Label about 5 evenly spaced periods, always the first and the last.
  const every = Math.max(1, Math.ceil((points.length - 1) / 4));
  const xLabelIdx = points.map((_, i) => i).filter((i) => i === points.length - 1 || (i % every === 0 && points.length - 1 - i >= every / 2));

  const summary = shown.map((s) => summarise(points, s)).join(" ");

  return (
    <AnalyticsPanel tone="reports" id={id} title={title} subtitle={subtitle} className="h-full flex flex-col">
      {isEmpty ? (
        <p className="px-3.5 py-3 text-xs text-slate-600 font-sans">{emptyText}</p>
      ) : (
        <div ref={wrapRef} className="p-3.5 flex-1">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700" aria-label="Legend">
            {shown.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 shrink-0" style={{ backgroundColor: SERIES_COLORS[i] }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block h-60 w-full max-w-full" role="img" aria-label={title}>
            <title>{title}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#94A3B8" : "#E2E8F0"} strokeWidth={1} />
                <text x={M.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#475569" className="tabular-nums">
                  {t}
                </text>
              </g>
            ))}
            {xLabelIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="#475569">
                {points[i].label}
              </text>
            ))}
            {shown.map((s, si) => ({ s, si })).reverse().map(({ s, si }) => {
              const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.values[s.key] ?? 0).toFixed(1)}`).join(" ");
              return (
                <g key={s.key}>
                  <path d={d} fill="none" stroke={SERIES_COLORS[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {(points.length >= 3 || points.length === 1) &&
                    points.map((p, i) => (
                      <circle key={i} cx={x(i)} cy={y(p.values[s.key] ?? 0)} r={3} fill="#FFFFFF" stroke={SERIES_COLORS[si]} strokeWidth={1.5}>
                        <title>{`${p.label}, ${s.label}: ${p.values[s.key] ?? 0}`}</title>
                      </circle>
                    ))}
                </g>
              );
            })}
          </svg>
          <p className="sr-only">{summary}</p>
          <DataTableToggle
            caption={title}
            columns={["Period", ...shown.map((s) => s.label)]}
            rows={points.map((p, i) => ({ key: `${i}-${p.label}`, cells: [p.label, ...shown.map((s) => p.values[s.key] ?? 0)] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
