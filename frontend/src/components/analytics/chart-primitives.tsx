import React, { useState } from "react";
import { CHART_TRACK, hatchStyle } from "../../lib/chart-palette";
import { GrowFill } from "./motion";

/** One segment of a stacked bar, or the single fill of a plain bar. */
export interface BarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Draw as a diagonal hatch: the value is an estimate. */
  hatched?: boolean;
}

const pctText = (value: number, total: number): string => (total > 0 ? `${Math.round((value / total) * 100)}%` : "0%");

interface BarMarkProps {
  label: string;
  value: number;
  /** Value that fills the track. */
  max: number;
  color: string;
  /** Percent shown in the accessible name. Defaults to value / max. */
  pct?: string;
  hatched?: boolean;
  /** Track height class, e.g. "h-3". */
  heightClass?: string;
  /** True when the bar sits inside a link or button, so it is reachable by keyboard on its own. */
  focusable?: boolean;
  className?: string;
  /** Position in a list, for the first-load stagger. */
  index?: number;
  /** Grow the fill from zero on first load. Off by default. */
  animate?: boolean;
}

/**
 * Horizontal bar. Announced as one image: "{label}: {value} ({pct})". The native tooltip repeats it.
 * The fill is anchored at the left edge; only the data end is rounded.
 */
export const BarMark: React.FC<BarMarkProps> = ({ label, value, max, color, pct, hatched, heightClass = "h-3", focusable, className = "", index = 0, animate = false }) => {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const text = `${label}: ${value} (${pct ?? pctText(value, max)})`;
  const fillStyle = { width: `${share}%`, minWidth: value > 0 ? 3 : 0, ...(hatched ? hatchStyle(color) : { backgroundColor: color }) };
  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      tabIndex={focusable ? 0 : undefined}
      className={`${heightClass} w-full overflow-hidden rounded-r-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}
      style={{ backgroundColor: CHART_TRACK }}
    >
      {animate ? (
        <GrowFill
          index={index}
          className="h-full rounded-r-[3px] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
          style={fillStyle}
        />
      ) : (
        <div className="h-full rounded-r-[3px]" style={fillStyle} />
      )}
    </div>
  );
};

interface StackedBarProps {
  label: string;
  segments: BarSegment[];
  /** Value that fills the full track. Defaults to the sum of segments. Use a shared max to compare rows. */
  max?: number;
  heightClass?: string;
  focusable?: boolean;
  className?: string;
  /** Position in a list, for the first-load stagger. */
  index?: number;
}

/** Segments of one bar with a 2px gap between fills. Announced as "{label}: A 3, B 2". */
export const StackedBar: React.FC<StackedBarProps> = ({ label, segments, max, heightClass = "h-3", focusable, className = "", index = 0 }) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const scale = max ?? total;
  const used = segments.filter((s) => s.value > 0);
  const text = `${label}: ${used.length === 0 ? "none" : used.map((s) => `${s.label} ${s.value}`).join(", ")}`;
  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      tabIndex={focusable ? 0 : undefined}
      className={`${heightClass} w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}
      style={{ backgroundColor: CHART_TRACK }}
    >
      <GrowFill
        index={index}
        className="flex h-full gap-[2px] motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
        style={{ width: `${scale > 0 ? Math.min(100, (total / scale) * 100) : 0}%` }}>
        {used.map((s) => (
          <div
            key={s.key}
            className="h-full last:rounded-r-[3px] motion-safe:transition-[flex-grow] motion-safe:duration-300"
            style={{ flexGrow: s.value, flexBasis: 0, minWidth: 3, ...(s.hatched ? hatchStyle(s.color) : { backgroundColor: s.color }) }}
          />
        ))}
      </GrowFill>
    </div>
  );
};

interface LegendItem {
  key: string;
  label: string;
  color: string;
  hatched?: boolean;
  /** Direct value, shown after the label. */
  value?: React.ReactNode;
}

/** Swatch plus text for each series. Colour never stands alone. */
export const ChartLegend: React.FC<{ items: LegendItem[]; className?: string; label?: string }> = ({ items, className = "", label = "Legend" }) => (
  <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700 ${className}`} aria-label={label}>
    {items.map((item) => (
      <li key={item.key} className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={item.hatched ? hatchStyle(item.color) : { backgroundColor: item.color }}
          aria-hidden="true"
        />
        {item.label}
        {item.value !== undefined && <span className="font-semibold tabular-nums text-slate-900">{item.value}</span>}
      </li>
    ))}
  </ul>
);

interface DataTableToggleProps {
  caption: string;
  columns: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
  className?: string;
  /** Text on the disclosure. */
  summary?: string;
}

/** Text alternative for a chart. The first column is the row header. */
export const DataTableToggle: React.FC<DataTableToggleProps> = ({ caption, columns, rows, className = "", summary = "View as table" }) => (
  <details className={`group mt-3 ${className}`}>
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8">
      {summary}
    </summary>
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[18rem] text-xs tabular-nums">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-navy-line text-left text-slate-600">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`py-1.5 font-semibold ${i === 0 ? "pr-3" : "px-2 text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-1.5 pr-3 text-left font-medium text-slate-900">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="px-2 py-1.5 text-right text-slate-800">
                    {cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

/** One part of a donut: a reason, a stage, an outcome. */
export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Gap between slices in px, so each segment reads as its own. */
const DONUT_GAP = 2;

interface DonutChartProps {
  /** Names the chart for screen readers and for the table alternative. */
  label: string;
  slices: DonutSlice[];
  /** Shown in the centre. Defaults to the total. */
  centerValue?: string;
  /** Small text under the centre value, e.g. "backouts". */
  centerLabel?: string;
  size?: number;
}

/**
 * Ring of slices with a legend. Each legend item is a button, so keyboard users can highlight a slice too:
 * hover or focus dims the other slices and shows "{label}: {value} ({pct})". Colour never stands alone.
 */
export const DonutChart: React.FC<DonutChartProps> = ({ label, slices, centerValue, centerLabel, size = 168 }) => {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  const stroke = Math.round(size * 0.2);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = shown.length > 1 ? DONUT_GAP : 0;
  const center = size / 2;

  // Each arc starts where the previous one ends. The ring is rotated so the first arc starts at 12 o'clock.
  let start = 0;
  const arcs = shown.map((slice) => {
    const length = (slice.value / total) * circumference;
    const arc = { slice, dash: Math.max(0, length - gap), offset: -start };
    start += length;
    return arc;
  });

  const summary = total > 0 ? `${label}: ${shown.map((s) => `${s.label} ${s.value}`).join(", ")}` : `${label}: nothing recorded`;
  const activeSlice = slices.find((s) => s.key === active && s.value > 0);

  return (
    // Legend goes under the ring in narrow side panels so long reason names keep one line.
    <div className="@container w-full">
      <div className="flex flex-col items-center gap-4 @md:flex-row @md:items-start">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summary} focusable="false" className="block">
            {total === 0 ? (
              <circle cx={center} cy={center} r={radius} fill="none" stroke={CHART_TRACK} strokeWidth={stroke} />
            ) : (
              <g transform={`rotate(-90 ${center} ${center})`}>
                {arcs.map(({ slice, dash, offset }) =>
                  dash > 0 ? (
                    <circle
                      key={slice.key}
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={stroke}
                      strokeDasharray={`${dash} ${circumference}`}
                      strokeDashoffset={offset}
                      style={{ opacity: active && active !== slice.key ? 0.35 : 1 }}
                      className="motion-safe:transition-opacity motion-safe:duration-150"
                      onMouseEnter={() => setActive(slice.key)}
                      onMouseLeave={() => setActive(null)}
                    />
                  ) : null
                )}
              </g>
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="font-display text-2xl font-semibold leading-none tabular-nums text-slate-950">{centerValue ?? String(total)}</span>
            {centerLabel && <span className="mt-1 text-xs font-sans text-slate-600">{centerLabel}</span>}
          </div>
        </div>

        <div className="min-w-0 w-full flex-1">
          {total === 0 ? (
            <p className="py-2 text-sm font-sans text-slate-600">Nothing recorded in these dates.</p>
          ) : (
            <>
              <ul className="space-y-0.5" aria-label={`${label} legend`}>
                {slices.map((s) => (
                  <li key={s.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(s.key)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(s.key)}
                      onBlur={() => setActive(null)}
                      className="flex min-h-11 w-full items-center gap-2 px-1 text-left text-xs font-sans text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8"
                    >
                      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
                      <span className="min-w-0 flex-1">{s.label}</span>
                      <span className="font-semibold tabular-nums text-slate-900">{s.value}</span>
                      <span className="w-10 text-right tabular-nums text-slate-600">{pctText(s.value, total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {/* Repeats the legend line for the slice in focus, larger, next to the ring. */}
              <p className="mt-2 min-h-5 text-xs font-semibold tabular-nums text-slate-900" aria-hidden="true">
                {activeSlice ? `${activeSlice.label}: ${activeSlice.value} (${pctText(activeSlice.value, total)})` : ""}
              </p>
            </>
          )}
        </div>
      </div>
      {total > 0 && (
        <DataTableToggle
          caption={label}
          columns={["Category", "Count", "Share"]}
          rows={slices.map((s) => ({ key: s.key, cells: [s.label, s.value, pctText(s.value, total)] }))}
        />
      )}
    </div>
  );
};
