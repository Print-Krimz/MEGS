import React from "react";
import { Link } from "@tanstack/react-router";
import { InfoTip } from "./InfoTip";
import { TEXT_LOSS } from "../../lib/chart-palette";
import { PeriodTag } from "./AnalyticsPanel";

interface AnalyticsKpiProps {
  label: string;
  value: React.ReactNode;
  /** The counts behind the number, e.g. "14 of 30 seats". */
  detail?: string;
  /** One plain sentence on how the number is worked out. Behind the (i) on the card, and read aloud with it. */
  definition: string;
  kind: "now" | "period";
  tone?: "default" | "alert";
  /** Makes the card a link to the records behind the number. */
  to?: string;
  /** Or scrolls to a section of this page by its id. */
  anchor?: string;
  /** Runs before scrolling, e.g. to open the tab that holds the section. */
  onActivate?: () => void;
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";

export const AnalyticsKpi: React.FC<AnalyticsKpiProps> = ({ label, value, detail, definition, kind, tone = "default", to, anchor, onActivate }) => {
  const body = (
    <>
      <div className="pr-6 text-xs font-semibold text-slate-700">{label}</div>
      <div className="mt-1 -ml-1.5">
        <PeriodTag kind={kind} />
      </div>
      <div className={`text-2xl font-sans font-bold mt-0.5 tabular-nums ${tone === "alert" ? TEXT_LOSS : "text-slate-950"}`}>{value}</div>
      {detail && <div className="text-xs text-slate-700 mt-0.5 font-sans">{detail}</div>}
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
      <div className="absolute right-2 top-2.5">
        <InfoTip label={label} align="right">
          {definition}
        </InfoTip>
      </div>
    </div>
  );
};

/** The row of headline numbers. */
export const KpiRow: React.FC<{ children: React.ReactNode; columns: string }> = ({ children, columns }) => (
  <div
    className={`grid grid-cols-2 ${columns} border border-slate-300 bg-white divide-x divide-y md:divide-y-0 divide-slate-300 max-md:[&>*:last-child:nth-child(odd)]:col-span-2`}
  >
    {children}
  </div>
);
