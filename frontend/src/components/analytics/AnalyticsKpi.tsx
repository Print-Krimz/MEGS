import React from "react";
import { Link } from "@tanstack/react-router";
import { InfoTip } from "./InfoTip";
import { AnimatedNumber } from "./motion";
import { TEXT_LOSS } from "../../lib/chart-palette";

interface AnalyticsKpiProps {
  label: string;
  /** A number (or "NN%") counts up when it loads or changes. Any other text, such as "—", shows as is. */
  value: number | string;
  /** The counts behind the number, e.g. "14 of 30 seats". A few words. */
  detail?: string;
  /** One short sentence on how the number is worked out. Behind the (i) on the card, and read aloud with it. */
  definition: string;
  /** No longer shown. The row states the period once. Kept so existing callers still compile. */
  kind?: "now" | "period";
  tone?: "default" | "alert";
  /** Makes the card a link to the records behind the number. */
  to?: string;
  /** Or scrolls to a section of this page by its id. */
  anchor?: string;
  /** Runs before scrolling, e.g. to open the tab that holds the section. */
  onActivate?: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";

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

export const AnalyticsKpi: React.FC<AnalyticsKpiProps> = ({ label, value, detail, definition, tone = "default", to, anchor, onActivate }) => {
  const body = (
    <>
      <div className="pr-7 text-xs font-semibold text-slate-700">{label}</div>
      <div className={`mt-1 font-display text-3xl font-semibold leading-9 tabular-nums whitespace-nowrap ${tone === "alert" ? TEXT_LOSS : "text-slate-950"}`}>
        {renderValue(value)}
      </div>
      {detail && <div className="mt-0.5 text-xs font-sans text-slate-600">{detail}</div>}
      <span className="sr-only">{definition}</span>
    </>
  );

  let card: React.ReactNode;
  if (to) {
    card = (
      <Link to={to as any} className={`block p-3.5 hover:bg-slate-50 ${FOCUS}`}>
        {body}
      </Link>
    );
  } else if (anchor) {
    card = (
      <a
        href={`#${anchor}`}
        onClick={(event) => {
          event.preventDefault();
          onActivate?.();
          // Let the tab render before scrolling to it.
          setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        }}
        className={`block p-3.5 hover:bg-slate-50 ${FOCUS}`}
      >
        {body}
      </a>
    );
  } else {
    card = <div className="p-3.5">{body}</div>;
  }

  // The (i) sits beside the card, not inside the link, so a card can be both a link and explained.
  return (
    <div className="relative">
      {card}
      <div className="absolute right-2 top-2 opacity-70 hover:opacity-100 focus-within:opacity-100 scale-90 origin-top-right">
        <InfoTip label={label} align="right">
          {definition}
        </InfoTip>
      </div>
    </div>
  );
};

/** The row of headline numbers. `caption` states the period once, above the row. */
export const KpiRow: React.FC<{ children: React.ReactNode; columns: string; caption?: string }> = ({ children, columns, caption }) => (
  <div>
    {caption && <p className="mb-1.5 text-xs font-sans text-slate-600">{caption}</p>}
    <div
      className={`grid grid-cols-2 ${columns} border border-slate-300 bg-white divide-x divide-y md:divide-y-0 divide-slate-300 max-md:[&>*:last-child:nth-child(odd)]:col-span-2`}
    >
      {children}
    </div>
  </div>
);
