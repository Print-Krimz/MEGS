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

/** Priority is how important the task is. How late it is shows separately, under Due. */
const PRIORITY = {
  HIGH: { label: "High", badge: "bg-[#FDF1F2] text-[#B42318]" },
  MEDIUM: { label: "Medium", badge: "bg-[#FFF4DC] text-[#7A4800]" },
  NORMAL: { label: "Low", badge: "bg-slate-100 text-slate-700" },
} as const;

/** The stage or step each kind of task belongs to, in the same words the stage chart uses. */
const CONTEXT: Record<TAPendingActionItem["type"], string> = {
  INITIAL_INTERVIEW: "Initial screening",
  CLIENT_ENDORSEMENT: "Client review",
  FINAL_INTERVIEW: "Final interview",
  COMPLIANCE_REVIEW: "Requirements",
  START_CONFIRMATION: "Start confirmation",
  CONTRACT_SIGNING: "Contract signing",
};

const DAY_MS = 86_400_000;
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

interface Timing {
  priority: TAPendingActionItem["urgency"];
  /** The main due line, and how it reads: late, soon or just waiting. */
  text: string;
  tone: "late" | "soon" | "plain";
  /** A second, muted line: the due date, or how long the task has waited. */
  sub?: string;
}

/**
 * A deadline before today (Manila) is overdue: "N days overdue", and the task counts as High whatever its stored priority.
 * A deadline today or later reads "Due today" or "Due in N days". With no deadline the age is shown as "Waiting N days".
 */
const timing = (r: TAPendingActionItem, today: string): Timing => {
  const waited = r.agingDays === undefined ? undefined : r.agingDays === 0 ? "Waiting since today" : `Waiting ${days(r.agingDays)}`;
  if (r.deadline) {
    const due = getManilaToday(new Date(r.deadline));
    const gap = Math.round((Date.parse(due) - Date.parse(today)) / DAY_MS);
    if (gap < 0) return { priority: "HIGH", text: `${days(-gap)} overdue`, tone: "late", sub: `Was due ${formatDate(r.deadline)}` };
    if (gap === 0) return { priority: r.urgency, text: "Due today", tone: "soon", sub: waited };
    return { priority: r.urgency, text: `Due in ${days(gap)}`, tone: "plain", sub: formatDate(r.deadline) };
  }
  return { priority: r.urgency, text: waited ?? "No due date", tone: "plain" };
};

/** Table columns once the panel is wide: task, candidate and job, stage, priority, due, action. */
const COLUMNS = "@3xl:grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_minmax(0,1.2fr)_5rem_minmax(0,1.4fr)_5rem]";

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
        <p className="p-6 text-center text-xs text-slate-600 font-sans">Nothing is waiting on you.</p>
      ) : (
        // Container queries: the side menu takes width, so the table starts when this panel is wide enough, not at a screen width.
        <div className="@container">
          <div aria-hidden="true" className={`hidden border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 @3xl:grid @3xl:gap-x-4 ${COLUMNS}`}>
            <span>Task</span>
            <span>Candidate / Job</span>
            <span>Stage</span>
            <span>Priority</span>
            <span>Due</span>
            <span className="text-right">Action</span>
          </div>
          <ul className="divide-y divide-slate-200">
            {rows.map((r) => {
              const t = timing(r, today);
              const priority = PRIORITY[t.priority];
              return (
                <li
                  key={r.id}
                  className={`flex flex-col gap-2 px-3.5 py-3.5 transition-colors hover:bg-navy-soft focus-within:bg-navy-soft motion-reduce:transition-none @3xl:grid @3xl:items-center @3xl:gap-x-4 ${COLUMNS}`}
                >
                  <p className="min-w-0 line-clamp-2 text-sm font-semibold text-slate-900" title={r.title}>
                    {r.title}
                  </p>
                  <div className="min-w-0 text-xs font-sans">
                    <p className="truncate text-sm text-slate-900">{r.candidateName}</p>
                    <p className="truncate text-slate-600">{r.jobTitle}</p>
                  </div>
                  <p className="min-w-0 truncate text-xs font-sans text-slate-700">{CONTEXT[r.type]}</p>
                  {/* Priority and due share a line on a narrow panel; in the table they are two columns. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 @3xl:contents">
                    <div>
                      <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold ${priority.badge}`}>{priority.label}</span>
                    </div>
                    <div className="text-xs font-sans tabular-nums">
                      <span className={`block font-semibold ${t.tone === "late" ? TEXT_LOSS : t.tone === "soon" ? TEXT_AMBER : "text-slate-800"}`}>{t.text}</span>
                      {t.sub && <span className="block text-slate-600">{t.sub}</span>}
                    </div>
                  </div>
                  <div className="@3xl:text-right">
                    <Link
                      to={r.targetUrl as never}
                      aria-label={`Open: ${r.title}, ${r.candidateName}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-navy bg-white px-3 text-xs font-semibold text-navy transition-colors hover:bg-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none md:min-h-8"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
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
