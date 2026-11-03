import React from "react";
import { Link } from "@tanstack/react-router";
import type { TAPendingActionItem } from "../../lib/types/analytics.types";
import { TEXT_AMBER, TEXT_LOSS } from "../../lib/chart-palette";
import { formatDate } from "../../lib/utils";
import { getManilaToday } from "../../lib/field-limits";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface ActionItemsListProps {
  rows: TAPendingActionItem[];
  /** Total before the list was capped per kind of task. */
  total: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** The report time; tests pass a fixed one. */
  now?: Date;
}

const URGENCY = {
  HIGH: { label: "High", badge: "bg-[#FDF1F2] text-[#B42318]" },
  MEDIUM: { label: "Medium", badge: "bg-[#FFF4DC] text-[#7A4800]" },
  NORMAL: { label: "Normal", badge: "bg-slate-100 text-slate-700" },
} as const;

const DAY_MS = 86_400_000;

/** A deadline before today (Manila) is overdue: it reads "N days overdue" and counts as High, whatever the stored urgency. */
const timing = (r: TAPendingActionItem, today: string): { text: string; urgency: TAPendingActionItem["urgency"] } => {
  if (r.deadline) {
    const due = getManilaToday(new Date(r.deadline));
    if (due < today) {
      const late = Math.round((Date.parse(today) - Date.parse(due)) / DAY_MS);
      return { text: `${late} ${late === 1 ? "day" : "days"} overdue`, urgency: "HIGH" };
    }
  }
  if (r.agingDays !== undefined) return { text: `${r.agingDays} ${r.agingDays === 1 ? "day" : "days"}`, urgency: r.urgency };
  return { text: r.deadline ? `Due ${formatDate(r.deadline)}` : "", urgency: r.urgency };
};

/** Tasks waiting on the recruiter, the same ones the Overview lists. Each opens the page where the task is done. */
export const ActionItemsList: React.FC<ActionItemsListProps> = ({ rows, total, bare = false, now }) => {
  const today = getManilaToday(now);
  return (
  <AnalyticsPanel
    tone="reports"
    id="action-items"
    title="Action items"
    subtitle="Tasks waiting on you."
    bare={bare}
    aside={<span className="tabular-nums">{total} waiting</span>}
  >
    {rows.length === 0 ? (
      <p className="p-6 text-center text-xs text-slate-500 font-sans">Nothing is waiting on you.</p>
    ) : (
      <ul className="divide-y divide-slate-200">
        {rows.map((r) => {
          const { text, urgency } = timing(r, today);
          return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{r.title}</p>
              <p className="truncate text-xs font-sans text-slate-600">
                {r.candidateName} · {r.jobTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`px-1.5 py-0.5 text-xs font-semibold ${URGENCY[urgency].badge}`}>{URGENCY[urgency].label}</span>
              {text && (
                <span className={`text-xs font-semibold tabular-nums ${urgency === "HIGH" ? TEXT_LOSS : urgency === "MEDIUM" ? TEXT_AMBER : "text-slate-700"}`}>{text}</span>
              )}
              <Link
                to={r.targetUrl as never}
                aria-label={`Open: ${r.title}, ${r.candidateName}`}
                className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
              >
                Open
              </Link>
            </div>
          </li>
          );
        })}
      </ul>
    )}
    <p className="border-t border-slate-200 px-3.5 py-2.5 text-xs font-sans text-slate-600">
      Showing {rows.length} of {total}.{" "}
      <Link to="/ta" className="font-semibold text-navy underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        See all on Overview
      </Link>
    </p>
  </AnalyticsPanel>
  );
};
