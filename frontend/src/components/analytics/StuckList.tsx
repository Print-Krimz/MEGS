import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StuckCandidate } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { TEXT_AMBER, TEXT_LOSS, WAIT } from "../../lib/chart-palette";
import { PaginationBar } from "./PaginationBar";
import { StackedBar } from "./chart-primitives";
import { StuckPreviewDialog } from "./StuckPreviewDialog";
import { daysAgoText } from "../../lib/analytics-format";
import { formatDate } from "../../lib/utils";

interface StuckListProps {
  rows: StuckCandidate[];
  /** Admin sees every recruiter and links to read-only pages. A TA sees their own and links to their working pages. */
  viewer?: "admin" | "ta";
  /** Show which recruiter holds each candidate. Off on the recruiter page, where every row is theirs. Defaults to on for Admin. */
  showRecruiter?: boolean;
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
  critical: { label: "Critical", badge: "bg-[#FDF1F2] text-[#B42318]" },
  overdue: { label: "Overdue", badge: "bg-[#FFF4DC] text-[#7A4800]" },
} as const;

const SELECT =
  "min-h-9 border border-slate-300 bg-white px-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

/** Days in the stage as a bar: a pale baseline up to the limit, then only the days past it in colour. */
const WaitBar: React.FC<{ row: number; r: StuckCandidate; color: string; index: number; className?: string }> = ({ row: scale, r, color, index, className }) => (
  <StackedBar
    className={className}
    label={`${r.stageLabel}, days in stage, limit ${r.slaDays} ${r.slaDays === 1 ? "day" : "days"}`}
    max={scale}
    heightClass="h-2"
    index={index}
    segments={[
      { key: "within", label: "Within days allowed", value: Math.min(r.daysInStage, r.slaDays), color: WAIT.withinLimit },
      { key: "over", label: "Past days allowed", value: Math.max(0, r.daysInStage - r.slaDays), color },
    ]}
  />
);

/** Candidates past their days allowed, longest wait first, so it is clear who is holding them up. */
export const StuckList = React.memo(function StuckList({
  rows,
  total,
  closedOpenings = 0,
  pageSize = 8,
  viewer = "admin",
  showRecruiter,
  id = "waiting-too-long",
  title = "Overdue candidates",
  subtitle = "Past the days allowed for their stage, longest wait first. Critical means twice the days allowed or more.",
  bare = false,
  focus,
  linkState,
}: StuckListProps) {
  const admin = viewer === "admin";
  const withRecruiter = showRecruiter ?? admin;
  const [urgency, setUrgency] = useState<"ALL" | "critical">("ALL");
  const [stage, setStage] = useState("ALL");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    if (!focus) return;
    setUrgency(focus.urgency ?? "ALL");
    setStage(focus.stage ?? "ALL");
    setQuery("");
    setPreviewId(null);
    setPage(1);
  }, [focus?.nonce, focus?.urgency, focus?.stage]);

  const stages = useMemo(() => [...new Map(rows.map((r) => [r.stage, r.stageLabel])).entries()], [rows]);
  const criticalCount = rows.filter((r) => r.urgency === "critical").length;

  const needle = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (urgency === "ALL" || r.urgency === "critical") &&
          (stage === "ALL" || r.stage === stage) &&
          (!needle ||
            [r.candidateName, r.jobTitle, r.clientName, withRecruiter ? r.recruiterName : ""].some((v) => (v ?? "").toLowerCase().includes(needle)))
      ),
    [rows, urgency, stage, needle, withRecruiter]
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
    <AnalyticsPanel tone="reports" id={id} title={title} subtitle={closedOpenings > 0 ? `${subtitle} ${closedOpenings} more are on closed job openings.` : subtitle} bare={bare} aside={<span className="tabular-nums">{total} waiting</span>}>
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
          <label className="flex w-full items-center gap-2 text-xs text-slate-700 sm:ml-auto sm:w-auto">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={withRecruiter ? "Candidate, job, client or recruiter" : "Candidate, job or client"}
              className="min-h-9 w-full border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-56"
            />
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No one is past the days allowed.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">
          {needle ? `No overdue candidates match “${query.trim()}”.` : "No match. Change the filters."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {pageRows.map((r, i) => {
            const style = URGENCY[r.urgency];
            return (
              <li key={r.applicationId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`shrink-0 px-1.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
                    {admin ? (
                      <Link
                        to="/admin/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        {...(linkState ? { state: linkState as never } : {})}
                        className="truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    ) : (
                      <Link
                        to="/ta/applications/$applicationId"
                        params={{ applicationId: String(r.applicationId) }}
                        className="truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {r.candidateName}
                      </Link>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`text-xs font-semibold tabular-nums ${r.urgency === "critical" ? TEXT_LOSS : TEXT_AMBER}`}>
                      {r.daysOver} {r.daysOver === 1 ? "day" : "days"} over
                    </span>
                    <button
                      type="button"
                      aria-label={`Quick view: ${r.candidateName}`}
                      onClick={() => setPreviewId(r.applicationId)}
                      className="inline-flex min-h-11 items-center px-1 text-xs font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-9"
                    >
                      Quick view
                    </button>
                  </div>
                </div>
                {/* Fixed label column, so every bar starts and ends at the same place whatever its "N of M days" width.
                    Phones: stage and days on one line, the bar full width under them. */}
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs font-sans text-slate-700 sm:grid-cols-[9rem_minmax(0,1fr)_6.5rem] sm:gap-y-0">
                  <span className="col-start-1 row-start-1 truncate font-semibold text-slate-900">{r.stageLabel}</span>
                  <WaitBar
                    className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"
                    row={scale}
                    index={i}
                    r={r}
                    color={r.urgency === "critical" ? WAIT.critical : WAIT.late}
                  />
                  <span className="col-start-2 row-start-1 whitespace-nowrap text-right tabular-nums sm:col-start-3">
                    <strong>{r.daysInStage}</strong> of {r.slaDays} days
                  </span>
                </div>
                <p className="mt-1 text-xs sm:truncate text-slate-600 font-sans">
                  {r.mrfId !== null ? (
                    <Link
                      to={admin ? "/admin/mrfs/$mrfId" : "/ta/mrfs/$mrfId"}
                      params={{ mrfId: String(r.mrfId) }}
                      {...(admin && linkState ? { state: linkState as never } : {})}
                      className="text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {r.jobTitle}
                    </Link>
                  ) : (
                    r.jobTitle
                  )}
                  {r.clientName ? ` · ${r.clientName}` : ""}
                  {r.estimated && <span> · estimated from application date</span>}
                  {withRecruiter && <span title={formatRecruiterName(r.recruiterName).full}> · {formatRecruiterName(r.recruiterName).label}</span>}
                </p>
                {r.lastActivityAt && (
                  <p className="mt-0.5 truncate text-xs text-slate-500 font-sans" title={formatDate(r.lastActivityAt)}>
                    Last activity: {daysAgoText(r.lastActivityAt)}
                    {r.lastNote ? ` · ${r.lastNote}` : ""}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <StuckPreviewDialog
        rows={visible}
        openId={previewId}
        onSelect={setPreviewId}
        onClose={() => setPreviewId(null)}
        viewer={viewer}
        showRecruiter={withRecruiter}
        linkState={linkState}
      />
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="candidates" />
      {total > rows.length && (
        <p className="border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">{`Top ${rows.length} of ${total}.`}</p>
      )}
    </AnalyticsPanel>
  );
});
