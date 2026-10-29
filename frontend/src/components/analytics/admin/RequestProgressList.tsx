import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RequestRow } from "../../../lib/types/analytics.types";
import { formatRecruiterName } from "../../../lib/recruiter-label";
import { formatDate } from "../../../lib/utils";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { HEALTH_CHIP, OUTCOME, TEXT_AMBER, TEXT_LOSS } from "../../../lib/chart-palette";
import { PaginationBar } from "../PaginationBar";
import { BarMark } from "./chart-primitives";
import { matchesRequestHealth, type RequestHealthFilter } from "../../../lib/admin-report-search";

interface RequestProgressListProps {
  rows: RequestRow[];
  /** Where a request title leads: the Admin read-only page or the TA page. */
  linkTo: "/admin/mrfs/$mrfId" | "/ta/mrfs/$mrfId";
  /** Show who each request is assigned to. A TA only sees their own, so it is left out there. */
  showOwner?: boolean;
  /** A data-quality line shown under the list. */
  note?: string;
  pageSize?: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** Applies a filter from outside, e.g. a click on the attention strip. A new nonce re-applies it. */
  focus?: { health: RequestHealthFilter; nonce: number };
  /** History state added to each request link, so the detail page can return to the same report. */
  linkState?: Record<string, unknown>;
}

export type { RequestHealthFilter };

const HEALTH: Record<RequestRow["health"], { label: string; badge: string; bar: string }> = {
  OVERDUE: { ...HEALTH_CHIP.overdue, badge: HEALTH_CHIP.overdue.className, bar: OUTCOME.backedOut },
  AT_RISK: { ...HEALTH_CHIP.atRisk, badge: HEALTH_CHIP.atRisk.className, bar: OUTCOME.notSelected },
  ON_TRACK: { ...HEALTH_CHIP.onTrack, badge: HEALTH_CHIP.onTrack.className, bar: OUTCOME.movedOn },
  FILLED: { ...HEALTH_CHIP.filled, badge: HEALTH_CHIP.filled.className, bar: OUTCOME.movedOn },
};

const ATTENTION: Record<Exclude<RequestRow["attention"], null>, { label: string; title: string; text: string }> = {
  NO_OPENING: { label: "No opening", title: "No job opening is posted for this request.", text: TEXT_AMBER },
  NO_APPLICANTS: { label: "No applicants", title: "Nobody has applied yet.", text: TEXT_AMBER },
  FIRST_STAGE_ONLY: { label: "None past review", title: "Every applicant is still in first review.", text: "text-slate-700" },
};

/** The short "how late or how soon" text. The target date is in the tooltip. */
const slaText = (row: RequestRow): string => {
  if (!row.targetFillDate || row.daysRemaining === null) return "No target date";
  if (row.daysRemaining < 0) return `${Math.abs(row.daysRemaining)} ${row.daysRemaining === -1 ? "day" : "days"} late`;
  if (row.daysRemaining === 0) return "Due today";
  return `Due in ${row.daysRemaining} ${row.daysRemaining === 1 ? "day" : "days"}`;
};

/** Open client requests, most urgent first, as one row each with a status filter, search and paging. */
export const RequestProgressList = React.memo(function RequestProgressList({
  rows,
  linkTo,
  showOwner = true,
  note,
  pageSize = 10,
  bare = false,
  focus,
  linkState,
}: RequestProgressListProps) {
  const [health, setHealth] = useState<RequestHealthFilter>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!focus) return;
    setHealth(focus.health);
    setQuery("");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const counts = useMemo(() => {
    const c: Record<RequestHealthFilter, number> = { ALL: rows.length, NONE: 0, LATE: 0, NO_OPENING: 0, OVERDUE: 0, AT_RISK: 0, ON_TRACK: 0, FILLED: 0 };
    for (const r of rows) {
      for (const key of Object.keys(c) as RequestHealthFilter[]) if (key !== "ALL" && matchesRequestHealth(r, key)) c[key]++;
    }
    return c;
  }, [rows]);

  const filters: { key: RequestHealthFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "OVERDUE", label: "Overdue" },
    { key: "AT_RISK", label: "At risk" },
    { key: "ON_TRACK", label: "On track" },
    { key: "FILLED", label: "Filled" },
    { key: "NONE", label: "No candidates" },
    // Reached from a tile above the list. Shown only while active, so the chip row stays short.
    ...(health === "LATE" ? [{ key: "LATE" as const, label: "Overdue or at risk" }] : []),
    ...(health === "NO_OPENING" ? [{ key: "NO_OPENING" as const, label: "No opening" }] : []),
  ];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      return matchesRequestHealth(r, health) && (!needle || `${r.title} ${r.clientName} ${r.ownerName} ${formatRecruiterName(r.ownerName).label}`.toLowerCase().includes(needle));
    });
  }, [rows, health, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AnalyticsPanel
      id="client-requests"
      title="Client requests"
      subtitle="Open requests and any filled this period, most urgent first."
      bare={bare}
      aside={<span className="tabular-nums">{rows.length} requests</span>}
    >
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-3.5 py-2.5">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={health === f.key}
                onClick={() => {
                  setHealth(f.key);
                  setPage(1);
                }}
                className={`min-h-9 px-2.5 text-xs font-semibold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  health === f.key ? "bg-navy text-white border-navy" : "bg-white text-slate-700 border-navy-line hover:bg-navy-soft"
                }`}
              >
                {f.label} <span className="tabular-nums font-normal">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <span className="text-xs font-semibold text-slate-600">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={showOwner ? "Request, client or recruiter" : "Request or client"}
              className="min-h-9 w-56 border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No client requests in this view.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No match. Change the status or search.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {pageRows.map((row) => {
            const style = HEALTH[row.health];
            const owner = formatRecruiterName(row.ownerName);
            const due = row.targetFillDate ? `Target ${formatDate(row.targetFillDate)}` : "No target date";
            return (
              <li key={row.mrfId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <Link
                      to={linkTo}
                      params={{ mrfId: String(row.mrfId) }}
                      {...(linkState ? { state: linkState as never } : {})}
                      className="truncate text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {row.title}
                    </Link>
                    <span className="truncate text-xs font-sans text-slate-600">{row.clientName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs font-sans" title={due}>
                    {row.health === "OVERDUE" ? (
                      <span className={`tabular-nums font-semibold ${TEXT_LOSS}`}>
                        <span className="sr-only">Overdue: </span>
                        {slaText(row)}
                      </span>
                    ) : (
                      <>
                        <span className="tabular-nums text-slate-600">{slaText(row)}</span>
                        <span className={`border px-1.5 py-0.5 font-semibold ${style.badge}`}>{style.label}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-[6rem_auto_minmax(0,1fr)] items-center gap-x-3 text-xs font-sans text-slate-700">
                  <BarMark label={`${row.title} seats filled`} value={Math.min(row.filled, row.headcount)} max={row.headcount} color={style.bar} heightClass="h-2" />
                  <span className="whitespace-nowrap tabular-nums">
                    <strong>{row.filled}</strong>/{row.headcount} seats
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                    {showOwner && row.ownerId !== null && (
                      <span title={owner.full} className="truncate text-slate-600">
                        {owner.label}
                      </span>
                    )}
                    {row.attention ? (
                      <span title={ATTENTION[row.attention].title} className={`font-semibold ${ATTENTION[row.attention].text}`}>
                        {ATTENTION[row.attention].label}
                      </span>
                    ) : (
                      <span className="tabular-nums" title={`${row.applicantCount} ${row.applicantCount === 1 ? "applicant" : "applicants"} in all`}>
                        {row.pipeline} in pipeline
                      </span>
                    )}
                    {row.overdueCandidates > 0 && <span className={`${TEXT_LOSS} tabular-nums`}>{row.overdueCandidates} overdue</span>}
                    {row.backoutsInPeriod > 0 && <span className={`${TEXT_LOSS} tabular-nums`}>{row.backoutsInPeriod} backed out</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="requests" />
      {note && <p id="requests-note" className="scroll-mt-4 border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">{note}</p>}
    </AnalyticsPanel>
  );
});
