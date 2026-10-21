import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StuckCandidate } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { HEALTH_CHIP, TEXT_AMBER, TEXT_LOSS } from "../../lib/chart-palette";
import { PaginationBar } from "./PaginationBar";

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
}

const URGENCY = {
  critical: { label: "Critical", badge: HEALTH_CHIP.overdue.className },
  overdue: { label: "Late", badge: HEALTH_CHIP.atRisk.className },
} as const;

const SELECT =
  "min-h-9 border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Candidates past their stage limit, longest wait first, so a team leader can see who is holding them up. */
export const StuckList = React.memo(function StuckList({
  rows,
  total,
  closedOpenings = 0,
  pageSize = 8,
  viewer = "admin",
  id = "waiting-too-long",
  title = "Waiting too long",
  subtitle = "Candidates past the allowed days for their stage. Verified waits first, then longest wait. Critical means twice the limit or more.",
  bare = false,
  focus,
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
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No candidate is past a stage limit.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No candidate matches. Change the filters above.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {pageRows.map((r) => {
            const style = URGENCY[r.urgency];
            return (
              <li key={r.applicationId} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-1.5 py-0.5 text-xs font-semibold border ${style.badge}`}>{style.label}</span>
                    {admin ? (
                      <Link
                        to="/admin/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        className="text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    ) : (
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        className="text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-700 font-sans">
                    {r.jobTitle}
                    {r.clientName ? ` · ${r.clientName}` : ""}
                    {r.mrfId !== null && (
                      <>
                        {" · "}
                        <Link
                          to={admin ? "/admin/mrfs/$mrfId" : "/ta/mrfs/$mrfId"}
                          params={{ mrfId: String(r.mrfId) }}
                          className="text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          View request
                        </Link>
                      </>
                    )}
                  </p>
                  {admin && (
                    <p className="text-xs text-slate-600 font-sans" title={formatRecruiterName(r.recruiterName).full}>
                      Handled by {formatRecruiterName(r.recruiterName).label}
                    </p>
                  )}
                </div>
                <div className="sm:shrink-0 sm:text-right">
                  <p className={`text-xs font-semibold tabular-nums ${r.urgency === "critical" ? `${TEXT_LOSS}` : `${TEXT_AMBER}`}`}>
                    {r.daysOver} {r.daysOver === 1 ? "day" : "days"} over the limit
                  </p>
                  <p className="text-xs text-slate-600 font-sans tabular-nums">
                    {r.stageLabel}: {r.daysInStage} days, limit {r.slaDays}
                  </p>
                  {r.estimated && (
                    <p className="text-xs text-slate-500 font-sans">Counted from the application date; no stage change was recorded.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="candidates" />
      {(total > rows.length || closedOpenings > 0) && (
        <p className="border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">
          {total > rows.length && `Showing the ${rows.length} longest waits of ${total}. `}
          {closedOpenings > 0 &&
            `${closedOpenings} more ${closedOpenings === 1 ? "candidate is" : "candidates are"} on closed openings and ${closedOpenings === 1 ? "is" : "are"} not listed.`}
        </p>
      )}
    </AnalyticsPanel>
  );
});
