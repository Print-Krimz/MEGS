import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StuckCandidate } from "../../../lib/types/analytics.types";
import { formatRecruiterName } from "../../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { HEALTH_CHIP, TEXT_AMBER, TEXT_LOSS, WAIT } from "../../../lib/chart-palette";
import { PaginationBar } from "../PaginationBar";
import { StackedBar } from "./chart-primitives";

interface StuckListProps {
  rows: StuckCandidate[];
  /** Admin sees every recruiter and links to read-only pages. A TA sees their own and links to their working pages. */
  viewer?: "admin" | "ta";
  id?: string;
  title?: string;
  subtitle?: string;
  /** Total before the server capped the list. */
  total: number;
  /** Candidates on closed openings. They are not listed because no one needs to act on them. */
  closedOpenings?: number;
  pageSize?: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** Applies a filter from outside, e.g. a click on the attention strip. A new nonce re-applies it. */
  focus?: { urgency?: "ALL" | "critical"; stage?: string; nonce: number };
  /** History state added to the Admin links, so the detail page can return to the same report. */
  linkState?: Record<string, unknown>;
}

const URGENCY = {
  critical: { label: "Critical", badge: HEALTH_CHIP.overdue.className },
  overdue: { label: "Late", badge: HEALTH_CHIP.atRisk.className },
} as const;

const SELECT =
  "min-h-9 border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Days in the stage as a bar: a pale baseline up to the limit, then only the days past it in colour. */
const WaitBar: React.FC<{ row: number; r: StuckCandidate; color: string; index: number }> = ({ row: scale, r, color, index }) => (
  <StackedBar
    label={`${r.stageLabel}, days in stage, limit ${r.slaDays} ${r.slaDays === 1 ? "day" : "days"}`}
    max={scale}
    heightClass="h-2"
    index={index}
    segments={[
      { key: "within", label: "Within limit", value: Math.min(r.daysInStage, r.slaDays), color: WAIT.withinLimit },
      { key: "over", label: "Past limit", value: Math.max(0, r.daysInStage - r.slaDays), color },
    ]}
  />
);

/** Candidates past their stage limit, longest wait first, so a team leader can see who is holding them up. */
export const StuckList = React.memo(function StuckList({
  rows,
  total,
  closedOpenings = 0,
  pageSize = 8,
  viewer = "admin",
  id = "waiting-too-long",
  title = "Waiting too long",
  subtitle = "Past the stage limit, longest wait first. Critical is twice the limit or more.",
  bare = false,
  focus,
  linkState,
}: StuckListProps) {
  const admin = viewer === "admin";
  const [urgency, setUrgency] = useState<"ALL" | "critical">("ALL");
  const [stage, setStage] = useState("ALL");
  const [recruiter, setRecruiter] = useState("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!focus) return;
    setUrgency(focus.urgency ?? "ALL");
    setStage(focus.stage ?? "ALL");
    setRecruiter("ALL");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const stages = useMemo(() => [...new Map(rows.map((r) => [r.stage, r.stageLabel])).entries()], [rows]);
  const recruiters = useMemo(() => [...new Map(rows.map((r) => [r.recruiterId, r.recruiterName])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const criticalCount = rows.filter((r) => r.urgency === "critical").length;

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (urgency === "ALL" || r.urgency === "critical") && (stage === "ALL" || r.stage === stage) && (recruiter === "ALL" || r.recruiterId === recruiter)
      ),
    [rows, urgency, stage, recruiter]
  );

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  // One scale for the page so the bars compare, wide enough to show every limit mark.
  const scale = Math.max(1, ...pageRows.map((r) => Math.max(r.daysInStage, r.slaDays)));
  const reset = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <AnalyticsPanel id={id} title={title} subtitle={subtitle} bare={bare} aside={<span className="tabular-nums">{total} waiting</span>}>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-slate-200 px-3.5 py-2.5">
          <div role="group" aria-label="Filter by urgency" className="flex gap-1.5">
            {(["ALL", "critical"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={urgency === key}
                onClick={() => reset(() => setUrgency(key))}
                className={`min-h-9 px-2.5 text-xs font-semibold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  urgency === key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {key === "ALL" ? "All" : "Critical"} <span className="tabular-nums font-normal">{key === "ALL" ? rows.length : criticalCount}</span>
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-0.5 text-xs text-slate-700">
            <span className="text-xs font-semibold text-slate-600">Stage</span>
            <select value={stage} onChange={(e) => reset(() => setStage(e.target.value))} className={SELECT}>
              <option value="ALL">All stages</option>
              {stages.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {admin && (
          <label className="flex flex-col gap-0.5 text-xs text-slate-700">
            <span className="text-xs font-semibold text-slate-600">Recruiter</span>
            <select value={recruiter} onChange={(e) => reset(() => setRecruiter(e.target.value))} className={SELECT}>
              <option value="ALL">All recruiters</option>
              {recruiters.map(([id, name]) => (
                <option key={id} value={id}>
                  {formatRecruiterName(name).label}
                </option>
              ))}
            </select>
          </label>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No one is past a stage limit.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No match. Change the filters.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {pageRows.map((r, i) => {
            const style = URGENCY[r.urgency];
            return (
              <li key={r.applicationId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 px-1.5 py-0.5 text-xs font-semibold border ${style.badge}`}>{style.label}</span>
                    {admin ? (
                      <Link
                        to="/admin/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        {...(linkState ? { state: linkState as never } : {})}
                        className="truncate text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    ) : (
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        className="truncate text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    )}
                  </div>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${r.urgency === "critical" ? TEXT_LOSS : TEXT_AMBER}`}>
                    {r.daysOver} {r.daysOver === 1 ? "day" : "days"} over
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-x-3 text-xs font-sans text-slate-700 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
                  <span className="truncate font-semibold text-slate-900">{r.stageLabel}</span>
                  <WaitBar row={scale} index={i} r={r} color={r.urgency === "critical" ? WAIT.critical : WAIT.late} />
                  <span className="whitespace-nowrap tabular-nums">
                    <strong>{r.daysInStage}</strong> of {r.slaDays} days
                    {r.estimated && (
                      <abbr title="Counted from the application date. No stage change was recorded." className="ml-1 no-underline cursor-help">
                        est.<span className="sr-only"> Counted from the application date. No stage change was recorded.</span>
                      </abbr>
                    )}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-600 font-sans">
                  {r.mrfId !== null ? (
                    <Link
                      to={admin ? "/admin/mrfs/$mrfId" : "/ta/mrfs/$mrfId"}
                      params={{ mrfId: String(r.mrfId) }}
                      {...(admin && linkState ? { state: linkState as never } : {})}
                      className="text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {r.jobTitle}
                    </Link>
                  ) : (
                    r.jobTitle
                  )}
                  {r.clientName ? ` · ${r.clientName}` : ""}
                  {admin && <span title={formatRecruiterName(r.recruiterName).full}> · {formatRecruiterName(r.recruiterName).label}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="candidates" />
      {(total > rows.length || closedOpenings > 0) && (
        <p className="border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">
          {total > rows.length && `Top ${rows.length} of ${total}. `}
          {closedOpenings > 0 && `${closedOpenings} more on closed openings.`}
        </p>
      )}
    </AnalyticsPanel>
  );
});
