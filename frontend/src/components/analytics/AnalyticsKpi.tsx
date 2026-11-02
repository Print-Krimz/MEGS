import React from "react";
import { Link } from "@tanstack/react-router";
import { AnimatedNumber } from "./motion";
import { TEXT_LOSS } from "../../lib/chart-palette";

interface AnalyticsKpiProps {
  label: string;
  /** A number (or "NN%") counts up when it loads or changes. Any other text, such as "Not enough data (n=3)", shows as is. */
  value: number | string;
  /** The counts behind the number, e.g. "14 of 30 seats". A few words. */
  detail?: string;
  tone?: "default" | "alert";
  /** Makes the tile a link. "#id" scrolls to that section of this page; any other path goes to that page. */
  href?: string;
  /** Runs on click, before scrolling, e.g. to open the tab that holds the section. Without `href` the tile is a button. */
  onClick?: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
const ACTIVE = `block w-full p-3.5 text-left hover:bg-slate-50 ${FOCUS}`;

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
export const AnalyticsKpi: React.FC<AnalyticsKpiProps> = ({ label, value, detail, tone = "default", href, onClick }) => {
  const text = typeof value === "string" && value.length > 8;
  const body = (
    <>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
      <div
        className={`mt-1 font-display font-semibold tabular-nums ${text ? "text-lg leading-9" : "whitespace-nowrap text-3xl leading-9"} ${
          tone === "alert" ? TEXT_LOSS : "text-slate-950"
        }`}
      >
        {renderValue(value)}
      </div>
      {detail && <div className="mt-0.5 text-xs font-sans text-slate-600">{detail}</div>}
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
          setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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

/** Tiles that share a time base, under one label. */
export const KpiGroup: React.FC<KpiGroupProps> = ({ label, children }) => (
  // Wider groups (more tiles) get proportionally more of the row.
  <section aria-label={label} className="min-w-0" style={{ flexGrow: React.Children.count(children), flexBasis: 0 }}>
    <h3 className="mb-1.5 text-xs font-semibold text-slate-700">{label}</h3>
    <div className="grid grid-cols-2 divide-x divide-y divide-slate-300 border border-slate-300 bg-white md:grid-flow-col md:auto-cols-fr md:divide-y-0 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
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
export const KpiRow: React.FC<KpiRowProps> = ({ children, definitions }) => (
  <div>
    <div className="flex flex-col gap-3 md:flex-row md:gap-4">{children}</div>
    <details className="mt-2">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8">
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

/** Plain grid of tiles for pages that show a few headline numbers with no time-base groups or definitions. */
export const KpiStrip: React.FC<{ children: React.ReactNode; columns: string }> = ({ children, columns }) => (
  <div
    className={`grid grid-cols-2 ${columns} border border-slate-300 bg-white divide-x divide-y md:divide-y-0 divide-slate-300 max-md:[&>*:last-child:nth-child(odd)]:col-span-2`}
  >
    {children}
  </div>
);
