import React from "react";
import { InfoTip } from "./InfoTip";

interface AnalyticsPanelProps {
  /** Anchor id so the "needs attention" strip can scroll to this section. */
  id?: string;
  title: string;
  /** Explains the panel. Behind an (i) next to the title by default; a visible caption under the header in the "reports" tone. */
  subtitle?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Content only: no frame. For panels inside another container, such as a tab. Keeps a hidden h2 and the subtitle as a visible caption. */
  bare?: boolean;
  /** "reports" is the enterprise slate-and-navy look of the Reports pages. The default keeps the navy frame the other admin pages use. */
  tone?: "reports";
}

/** Shared frame for analytics sections so every panel has a cohesive enterprise header. */
export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ id, title, subtitle, aside, children, className = "", bare = false, tone }) => {
  const reports = tone === "reports";
  if (bare) {
    return reports ? (
      <div id={id} className={`scroll-mt-4 ${className}`}>
        <h2 className="sr-only">{title}</h2>
        {subtitle && <p className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs font-sans text-slate-600">{subtitle}</p>}
        {children}
      </div>
    ) : (
      <div id={id} className={`scroll-mt-4 ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <section
      id={id}
      className={`scroll-mt-4 overflow-hidden rounded-lg border ${
        reports
          ? "border-slate-300 bg-white shadow-[0_1px_3px_0_rgb(15_23_42/0.06)]"
          : "border-navy-line bg-white"
      } ${className}`}
    >
      {reports && <div aria-hidden="true" className="h-0.5 w-full bg-navy/85" />}
      <div
        className={`px-4 py-3 border-b ${
          reports
            ? "border-slate-200 bg-gradient-to-r from-[#F4F7FB] via-white to-[#F8FAFC]"
            : "border-navy-line bg-navy-soft"
        } flex items-center justify-between gap-3`}
      >
        <div className="min-w-0 flex items-center gap-2.5">
          {reports && <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full bg-navy" />}
          <h2 className="text-sm font-bold tracking-tight text-slate-950">{title}</h2>
          {subtitle && !reports && <InfoTip label={title}>{subtitle}</InfoTip>}
        </div>
        {aside && <div className="shrink-0 text-xs text-slate-600">{aside}</div>}
      </div>
      {reports && subtitle && <p className="border-b border-slate-200 bg-slate-50/50 px-4 py-2 text-xs font-sans text-slate-600">{subtitle}</p>}
      {children}
    </section>
  );
};
