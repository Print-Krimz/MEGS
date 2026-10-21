import React from "react";
import { CHART_TRACK, hatchStyle } from "../../lib/chart-palette";

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
}

/**
 * Horizontal bar. Announced as one image: "{label}: {value} ({pct})". The native tooltip repeats it.
 * The fill is anchored at the left edge; only the data end is rounded.
 */
export const BarMark: React.FC<BarMarkProps> = ({ label, value, max, color, pct, hatched, heightClass = "h-3", focusable, className = "" }) => {
  const share = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const text = `${label}: ${value} (${pct ?? pctText(value, max)})`;
  return (
    <div
      role="img"
      aria-label={text}
      title={text}
      tabIndex={focusable ? 0 : undefined}
      className={`${heightClass} w-full overflow-hidden rounded-r-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${className}`}
      style={{ backgroundColor: CHART_TRACK }}
    >
      <div
        className="h-full rounded-r-[3px]"
        style={{ width: `${share}%`, minWidth: value > 0 ? 3 : 0, ...(hatched ? hatchStyle(color) : { backgroundColor: color }) }}
      />
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
}

/** Segments of one bar with a 2px gap between fills. Announced as "{label}: A 3, B 2". */
export const StackedBar: React.FC<StackedBarProps> = ({ label, segments, max, heightClass = "h-3", focusable, className = "" }) => {
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
      <div className="flex h-full gap-[2px]" style={{ width: `${scale > 0 ? Math.min(100, (total / scale) * 100) : 0}%` }}>
        {used.map((s) => (
          <div
            key={s.key}
            className="h-full last:rounded-r-[3px]"
            style={{ flexGrow: s.value, flexBasis: 0, minWidth: 3, ...(s.hatched ? hatchStyle(s.color) : { backgroundColor: s.color }) }}
          />
        ))}
      </div>
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
}

/** Text alternative for a chart. The first column is the row header. */
export const DataTableToggle: React.FC<DataTableToggleProps> = ({ caption, columns, rows, className = "" }) => (
  <details className={`group mt-3 ${className}`}>
    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8">
      View as table
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
