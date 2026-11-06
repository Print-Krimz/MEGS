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
  /** "reports" is the plain slate look of the Reports pages. The default keeps the navy frame the other admin pages use. */
  tone?: "reports";
}

/** Shared frame for analytics sections so every panel has the same header. */
export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ id, title, subtitle, aside, children, className = "", bare = false, tone }) => {
  const reports = tone === "reports";
  if (bare) {
    return reports ? (
      <div id={id} className={`scroll-mt-4 ${className}`}>
        <h2 className="sr-only">{title}</h2>
        {subtitle && <p className="border-b border-slate-200 px-3.5 py-2 text-xs font-sans text-slate-600">{subtitle}</p>}
        {children}
      </div>
    ) : (
      <div id={id} className={`scroll-mt-4 ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <section id={id} className={`scroll-mt-4 rounded-md border ${reports ? "border-slate-300 bg-white shadow-xs" : "border-navy-line bg-white"} ${className}`}>
      <div className={`px-3.5 py-2.5 border-b ${reports ? "border-slate-200 bg-slate-50/70" : "border-navy-line bg-navy-soft"} flex items-center justify-between gap-3`}>
        <div className="min-w-0 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
          {subtitle && !reports && <InfoTip label={title}>{subtitle}</InfoTip>}
        </div>
        {aside && <div className="shrink-0 text-xs text-slate-600">{aside}</div>}
      </div>
      {reports && subtitle && <p className="border-b border-slate-200 px-3.5 py-2 text-xs font-sans text-slate-600">{subtitle}</p>}
      {children}
    </section>
  );
};
