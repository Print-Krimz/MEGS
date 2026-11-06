import React, { useState } from "react";
import { User } from "lucide-react";
import type { DueSoonCandidate } from "../../lib/types/analytics.types";
import { TEXT_AMBER } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { StuckPreviewDialog } from "./StuckPreviewDialog";

interface DueSoonListProps {
  rows: DueSoonCandidate[];
  /** Total before the server capped the list. */
  total: number;
  viewer: "admin" | "ta";
  showRecruiter?: boolean;
  linkState?: Record<string, unknown>;
  className?: string;
}

const SHOWN = 5;

const dueText = (daysLeft: number) => (daysLeft === 0 ? "Due today" : `Due in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`);

/** Candidates who reach their stage limit within two days, soonest first. */
export const DueSoonList: React.FC<DueSoonListProps> = ({ rows, total, viewer, showRecruiter = false, linkState, className }) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, SHOWN);
  const dueTodayCount = rows.filter((r) => r.daysLeft === 0).length;
  const dueSoonCount = rows.filter((r) => r.daysLeft > 0).length;

  return (
    <AnalyticsPanel
      tone="reports"
      id="due-soon"
      title="Due soon"
      subtitle="Reach the stage limit within 2 days"
      aside={
        total > 0 ? (
          <span className="rounded-sm border border-[#F3D19E] bg-[#FFF4DC] px-2 py-0.5 text-xs tabular-nums font-semibold text-[#7A4800]">
            <strong className="text-slate-900">{total}</strong> approaching limit
          </span>
        ) : undefined
      }
      className={`flex flex-col ${className ?? ""}`}
    >
      {shown.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-600 font-sans">Nothing due in the next 2 days.</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mx-4 mt-3 mb-1 grid grid-cols-3 gap-2 rounded-md border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-xs font-sans"
          >
            <div>
              <span className="block text-[11px] font-medium text-slate-500">Approaching limit</span>
              <span className="text-sm font-bold tabular-nums text-slate-950">{total}</span>
            </div>
            <div className="border-l border-slate-200/80 pl-2.5">
              <span className="block text-[11px] font-medium text-slate-500">Expiring today</span>
              <span className={`text-sm font-bold tabular-nums ${dueTodayCount > 0 ? TEXT_AMBER : "text-slate-700"}`}>
                {dueTodayCount}
              </span>
            </div>
            <div className="border-l border-slate-200/80 pl-2.5">
              <span className="block text-[11px] font-medium text-slate-500">Next 48 hours</span>
              <span className="text-sm font-bold tabular-nums text-navy">{dueSoonCount}</span>
            </div>
          </div>
          <ul className="flex-1 divide-y divide-slate-200/90 px-4">
            {shown.map((r) => {
              const pct = r.slaDays > 0 ? Math.min(100, Math.round((r.daysInStage / r.slaDays) * 100)) : 100;
              return (
                <li key={r.applicationId} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-slate-50/70">
                  {/* 1. Candidate name first, 2. Supporting details second */}
                  <div className="flex min-w-0 items-center gap-3 text-xs font-sans">
                    <span
                      aria-hidden="true"
                      className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-navy-line bg-navy-soft text-navy sm:inline-flex"
                    >
                      <User className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-950">{r.candidateName}</p>
                        <span
                          className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                            r.daysLeft === 0
                              ? "border-[#F3D19E] bg-[#FFF4DC] text-[#7A4800]"
                              : `border-slate-200 bg-slate-50 ${TEXT_AMBER}`
                          }`}
                        >
                          {dueText(r.daysLeft)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-600">
                        {r.jobTitle ? <span>{r.jobTitle} · </span> : null}
                        {r.stageLabel}
                        <span className="tabular-nums text-slate-500">{` · ${r.daysInStage} of ${r.slaDays} days`}</span>
                      </p>
                      <div aria-hidden="true" className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-200/90">
                        <div
                          className={`h-full rounded-full ${r.daysLeft === 0 ? "bg-[#9A5B00]" : "bg-[#1D4ED8]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {/* 3. Quick View tertiary */}
                  <button
                    type="button"
                    aria-label={`Quick view: ${r.candidateName}`}
                    onClick={() => setOpenId(r.applicationId)}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-md border border-navy-line bg-white px-3 text-xs font-semibold text-navy shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-8"
                  >
                    Quick view
                  </button>
                </li>
              );
            })}
          </ul>
          {(total > shown.length || rows.length > SHOWN) && (
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/75 px-4 py-2.5 text-xs font-sans text-slate-600">
              {total > shown.length ? <span>+{total - shown.length} more</span> : <span />}
              {rows.length > SHOWN && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="font-semibold text-navy underline underline-offset-2 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {expanded ? "Show fewer" : `Show all ${rows.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}
      <StuckPreviewDialog
        rows={rows}
        openId={openId}
        onSelect={setOpenId}
        onClose={() => setOpenId(null)}
        viewer={viewer}
        showRecruiter={showRecruiter}
        linkState={linkState}
      />
    </AnalyticsPanel>
  );
};
