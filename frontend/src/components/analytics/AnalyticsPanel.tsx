import React from "react";
import { InfoTip } from "./InfoTip";

interface AnalyticsPanelProps {
  /** Anchor id so the "needs attention" strip can scroll to this section. */
  id?: string;
  title: string;
  /** Explains the panel. Shown behind an (i) next to the title, not as a line of text under it. */
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Content only: no frame or header. For panels that sit inside another container, such as a tab. */
  bare?: boolean;
}

/** Shared frame for analytics sections so every panel has the same header. */
export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ id, title, subtitle, aside, children, className = "", bare = false }) =>
  bare ? (
    <div id={id} className={`scroll-mt-4 ${className}`}>
      {children}
    </div>
  ) : (
    <section id={id} className={`scroll-mt-4 rounded-md border border-navy-line bg-white ${className}`}>
      <div className="px-3.5 py-2.5 border-b border-navy-line bg-navy-soft flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {subtitle && <InfoTip label={title}>{subtitle}</InfoTip>}
        </div>
        {aside && <div className="shrink-0 text-xs text-slate-600">{aside}</div>}
      </div>
      {children}
    </section>
  );

interface PeriodTagProps {
  kind: "now" | "period";
}

/** Marks whether a number is a snapshot of today or counts events inside the selected date range. */
export const PeriodTag: React.FC<PeriodTagProps> = ({ kind }) => (
  <span
    className={`ml-1.5 px-1 py-px whitespace-nowrap text-[11px] font-mono font-medium rounded border align-middle ${
      kind === "now" ? "bg-slate-100 text-slate-600 border-slate-300" : "bg-navy-soft text-navy border-navy-line"
    }`}
  >
    {kind === "now" ? "Now" : "In period"}
  </span>
);
