import React, { useState } from "react";
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
  const shown = rows.slice(0, SHOWN);

  return (
    <AnalyticsPanel tone="reports" id="due-soon" title="Due soon" subtitle="Reach the stage limit within 2 days" className={className}>
      {shown.length === 0 ? (
        <p className="p-4 text-center text-xs text-slate-600 font-sans">Nothing due in the next 2 days.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-200 px-3.5">
            {shown.map((r) => (
              <li key={r.applicationId} className="flex items-center justify-between gap-3 py-2.5">
                {/* 1. Candidate name first, 2. Supporting details second */}
                <div className="min-w-0 text-xs font-sans">
                  <p className="truncate text-sm font-semibold text-slate-950">{r.candidateName}</p>
                  <p className="truncate text-xs text-slate-600 mt-0.5">
                    {r.jobTitle ? <span>{r.jobTitle} · </span> : null}
                    {r.stageLabel} · <span className={`font-semibold tabular-nums ${TEXT_AMBER}`}>{dueText(r.daysLeft)}</span>
                  </p>
                </div>
                {/* 3. Quick View tertiary */}
                <button
                  type="button"
                  aria-label={`Quick view: ${r.candidateName}`}
                  onClick={() => setOpenId(r.applicationId)}
                  className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs font-medium text-slate-600 underline underline-offset-2 decoration-slate-300 hover:text-navy hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
                >
                  Quick view
                </button>
              </li>
            ))}
          </ul>
          {total > shown.length && <p className="border-t border-slate-200 px-3.5 py-2 text-xs font-sans text-slate-600">+{total - shown.length} more</p>}
        </>
      )}
      <StuckPreviewDialog
        rows={shown}
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
