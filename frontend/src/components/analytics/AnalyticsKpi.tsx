import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { AnimatedNumber } from "./motion";
import { TEXT_GOOD, TEXT_LOSS } from "../../lib/chart-palette";
import { scrollToId } from "../../lib/scroll-to";

/** Change against an earlier period. The change line shows only when both values exist. */
export interface KpiDelta {
  current: number | null;
  previous: number | null;
  /** "%" changes are percentage points; "days" are days. */
  unit?: "%" | "days" | "";
  /** Which direction is good: starts go "up", days to fill go "down". */
  better: "up" | "down";
  /** The earlier period, e.g. "previous 7 days". Shown as "vs {periodLabel}". */
  periodLabel: string;
}

interface AnalyticsKpiProps {
  label: string;
  /** A number (or "NN%") counts up when it loads or changes. Any other text, such as "Too few to show (3 cases)", shows as is. */
  value: number | string;
  /** The counts behind the number, e.g. "14 of 30 seats". A few words. */
  detail?: string;
  tone?: "default" | "alert";
  /** Makes the tile a link. "#id" scrolls to that section of this page; any other path goes to that page. */
  href?: string;
  /** Runs on click, before scrolling, e.g. to open the tab that holds the section. Without `href` the tile is a button. */
  onClick?: () => void;
  /** Change since the earlier period, one line under the value. */
  delta?: KpiDelta;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
const ACTIVE = `block w-full p-3.5 text-left transition-shadow motion-reduce:transition-none hover:bg-slate-50 hover:shadow-sm ${FOCUS}`;

/** A change as shown ("+3", "-1.2 days", "+4.5 pts") and as read aloud ("3", "1.2 days", "4.5 percentage points"). */
const deltaParts = (change: number, unit: KpiDelta["unit"]) => {
  const size = Number.isInteger(change) ? String(Math.abs(change)) : Math.abs(change).toFixed(1);
  const sign = change > 0 ? "+" : "-";
  if (unit === "%") return { short: `${sign}${size} pts`, spoken: `${size} percentage points` };
  if (unit === "days") {
    const word = Math.abs(change) === 1 ? "day" : "days";
    return { short: `${sign}${size} ${word}`, spoken: `${size} ${word}` };
  }
  return { short: `${sign}${size}`, spoken: size };
};

/** Values as they read in the sentence "... from 11 in the previous 7 days". */
const valueText = (value: number, unit: KpiDelta["unit"]) => {
  const size = Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (unit === "%") return `${size}%`;
  if (unit === "days") return `${size} ${value === 1 ? "day" : "days"}`;
  return size;
};

const deltaLine = ({ current, previous, unit, better, periodLabel }: KpiDelta) => {
  if (current === null || previous === null) return null;
  // Rounded to one decimal so float noise never shows as a change.
  const change = Math.round((current - previous) * 10) / 10;
  const up = change > 0;
  const flat = change === 0;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  const tone = flat ? "text-slate-600" : up === (better === "up") ? TEXT_GOOD : TEXT_LOSS;
  const { short, spoken } = deltaParts(change, unit);
  const word = flat ? "No change" : up ? "Up" : "Down";
  return (
    <div className={`mt-1 flex items-center gap-1 text-xs font-sans font-semibold tabular-nums ${tone}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span aria-hidden="true">
        {flat ? "No change" : short} <span className="font-normal text-slate-600">vs {periodLabel}</span>
      </span>
      <span className="sr-only">
        {flat ? `No change from ${valueText(previous, unit)}` : `${word} ${spoken} from ${valueText(previous, unit)}`} in the {periodLabel}
      </span>
    </div>
  );
};

/** Counts in the same precision as the final value, so 62.5% never lands as 63%. */
const formatLike = (target: number, suffix = "") => {
  const decimals = Number.isInteger(target) ? 0 : (String(target).split(".")[1]?.length ?? 0);
  return (n: number) => `${n.toFixed(Math.min(decimals, 1))}${suffix}`;
};

const renderValue = (value: number | string) => {
  if (typeof value === "number") return <AnimatedNumber value={value} format={formatLike(value)} />;
  const percent = /^(-?\d+(?:\.\d+)?)%$/.exec(value);
  if (percent) {
    const target = Number(percent[1]);
    return <AnimatedNumber value={target} format={formatLike(target, "%")} />;
  }
  return value;
};

/** One headline number: label, value, one detail line. What it means is under "How these are counted". */
export const AnalyticsKpi: React.FC<AnalyticsKpiProps> = ({ label, value, detail, tone = "default", href, onClick, delta }) => {
  // Words ("Too few to show (3 cases)", "No seats") read as an absence, so they sit below headline numbers in size.
  const text = typeof value === "string" && !/^-?\d[\d.,]*\s?(%|days?)?$/.test(value);
  const body = (
    <>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div
        className={`mt-1 font-display font-semibold tabular-nums ${text ? "text-base leading-9" : "whitespace-nowrap text-3xl leading-9"} ${
          tone === "alert" ? TEXT_LOSS : text ? "text-slate-700" : "text-slate-950"
        }`}
      >
        {renderValue(value)}
      </div>
      {delta && deltaLine(delta)}
      {detail && <div className="mt-0.5 text-balance text-xs font-sans text-slate-600">{detail}</div>}
    </>
  );

  if (href && !href.startsWith("#")) {
    return (
      <Link to={href as any} onClick={onClick} className={ACTIVE}>
        {body}
      </Link>
    );
  }
  if (href) {
    const id = href.slice(1);
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          onClick?.();
          // Let a newly opened tab render before scrolling to it.
          setTimeout(() => scrollToId(id), 0);
        }}
        className={ACTIVE}
      >
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={ACTIVE}>
        {body}
      </button>
    );
  }
  return <div className="p-3.5">{body}</div>;
};

interface KpiGroupProps {
  /** The time base for every tile in the group, stated once. */
  label: "Right now" | "In these dates";
  children: React.ReactNode;
}

const SPAN: Record<number, string> = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" };

/** Tiles that share a time base, under one label. */
export const KpiGroup: React.FC<KpiGroupProps> = ({ label, children }) => (
  // A group spans as many columns as it has tiles, so every tile in the row is the same width.
  <section aria-label={label} className={`flex min-w-0 flex-col ${SPAN[React.Children.count(children)] ?? ""}`}>
    <h3 className="mb-1.5 text-xs font-semibold text-slate-700">{label}</h3>
    {/* A lone tile fills its group; two columns would leave it half width. */}
    <div className={`grid ${React.Children.count(children) === 1 ? "grid-cols-1" : "grid-cols-2"} flex-1 overflow-hidden rounded-md divide-x divide-y divide-slate-300 border border-slate-300 bg-white md:grid-flow-col md:auto-cols-fr md:divide-y-0 max-md:[&>*:last-child:nth-child(odd)]:col-span-2`}>
      {children}
    </div>
  </section>
);

interface KpiRowProps {
  /** One or two `KpiGroup`s. */
  children: React.ReactNode;
  /** Plain-words definitions, listed once under the row. */
  definitions: { label: string; definition: string }[];
}

/** The row of headline numbers, with one disclosure that says how each is counted. */
export const KpiRow: React.FC<KpiRowProps> = ({ children, definitions }) => {
  const totalTiles = React.Children.toArray(children).reduce<number>(
    (sum, group) => sum + (React.isValidElement<{ children?: React.ReactNode }>(group) ? React.Children.count(group.props.children) : 1),
    0,
  );
  const gridCols = totalTiles === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <div>
      <div className={`grid gap-3 ${gridCols} md:gap-4`}>{children}</div>
      <details className="mt-2">
        <summary className="group inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-navy underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8">
          <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
            &#9656;
          </span>
          How these are counted
        </summary>
        <dl className="mt-1 grid gap-x-4 gap-y-1.5 text-xs text-slate-700 sm:grid-cols-[max-content_1fr]">
          {definitions.map((d) => (
            <React.Fragment key={d.label}>
              <dt className="font-semibold text-slate-900">{d.label}</dt>
              <dd>{d.definition}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
    </div>
  );
};

/** Plain grid of tiles for pages that show a few headline numbers with no time-base groups or definitions. */
export const KpiStrip: React.FC<{ children: React.ReactNode; columns: string }> = ({ children, columns }) => (
  <div
    className={`grid grid-cols-2 ${columns} overflow-hidden rounded-md border border-slate-300 bg-white divide-x divide-y md:divide-y-0 divide-slate-300 max-md:[&>*:last-child:nth-child(odd)]:col-span-2`}
  >
    {children}
  </div>
);
