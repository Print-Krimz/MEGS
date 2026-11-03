import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RequestRow } from "../../lib/types/analytics.types";
import { recruiterDisplayName, type RecruiterLabel } from "../../lib/recruiter-label";
import { formatDate } from "../../lib/utils";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { BAR_ON_TRACK, HEALTH_CHIP, TEXT_LOSS, WORKLOAD } from "../../lib/chart-palette";
import { PaginationBar } from "./PaginationBar";
import { matchesRequestHealth, type RequestHealthFilter } from "../../lib/admin-report-search";

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

const HEALTH: Record<RequestRow["health"], { label: string; badge: string }> = {
  OVERDUE: { ...HEALTH_CHIP.overdue, badge: HEALTH_CHIP.overdue.className },
  AT_RISK: { ...HEALTH_CHIP.atRisk, badge: HEALTH_CHIP.atRisk.className },
  // On track gets its own tint here: the shared chip is transparent, which reads as no status in a table column.
  ON_TRACK: { ...HEALTH_CHIP.onTrack, badge: "bg-[#EAF6EE] text-[#1B6B3A]" },
  FILLED: { ...HEALTH_CHIP.filled, badge: HEALTH_CHIP.filled.className },
};

const ATTENTION: Record<Exclude<RequestRow["attention"], null>, { label: string; title: string; chip: string }> = {
  NO_OPENING: { label: "No job opening", title: "No job opening is posted for this request.", chip: "bg-[#FFF4DC] text-[#7A4800]" },
  NO_APPLICANTS: { label: "No applicants", title: "Nobody has applied yet.", chip: "bg-[#FFF4DC] text-[#7A4800]" },
  FIRST_STAGE_ONLY: { label: "None past first screening", title: "Every applicant is still in first review.", chip: "bg-slate-100 text-slate-700" },
};

/** Table columns once the panel is wide: request, seats, recruiter (Admin only), pipeline, urgency. */
const COLUMNS_WITH_OWNER = "@2xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_minmax(8rem,1fr)]";
const COLUMNS_NO_OWNER = "@2xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)_minmax(0,2fr)_minmax(8rem,1fr)]";

/** A request this many days past its target date, or more, gets the solid red chip. */
const SEVERE_DAYS_LATE = -30;

/** The short "how late or how soon" text. The target date is printed next to it. */
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

  const focusNonce = focus?.nonce;
  const focusHealth = focus?.health;
  useEffect(() => {
    if (focusNonce === undefined || !focusHealth) return;
    setHealth(focusHealth);
    setQuery("");
    setPage(1);
  }, [focusNonce, focusHealth]);

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
    ...(health === "NO_OPENING" ? [{ key: "NO_OPENING" as const, label: "No job opening" }] : []),
  ];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      return matchesRequestHealth(r, health) && (!needle || `${r.title} ${r.clientName} ${r.ownerName}`.toLowerCase().includes(needle));
    });
  }, [rows, health, query]);

  const columns = showOwner ? COLUMNS_WITH_OWNER : COLUMNS_NO_OWNER;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AnalyticsPanel tone="reports"
      id="client-requests"
      title="Client requests"
      subtitle="Open requests, plus any filled in these dates, most urgent first."
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
                className={`min-h-11 md:min-h-9 px-2.5 text-xs font-semibold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  health === f.key ? "bg-navy text-white border-navy" : "bg-white text-slate-700 border-navy-line hover:bg-navy-soft"
                }`}
              >
                {f.label}{" "}
                <span className={`tabular-nums ${f.key === "OVERDUE" && counts.OVERDUE > 0 && health !== "OVERDUE" ? `font-semibold ${TEXT_LOSS}` : "font-normal"}`}>
                  {counts[f.key]}
                </span>
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
              className="min-h-11 md:min-h-9 w-56 border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No client requests in this view.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No match. Change the status or search.</p>
      ) : (
        // Container queries, not viewport ones: the side menu takes width, so the table starts when this panel is wide enough.
        <div className="@container">
          <div aria-hidden="true" className={`hidden border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 @2xl:grid @2xl:gap-x-4 ${columns}`}>
            <span>Request / Client</span>
            <span>Seats &amp; target date</span>
            {showOwner && <span>Recruiter</span>}
            <span>Pipeline</span>
            <span>Urgency</span>
          </div>
          <ul className="divide-y divide-slate-200">
            {pageRows.map((row) => {
              const owner: RecruiterLabel = row.ownerId === null ? { label: "No recruiter assigned" } : recruiterDisplayName(row.ownerName);
              const overdue = row.health === "OVERDUE";
              // Far past the target date reads as solid red, so the worst requests stand out from the merely late ones.
              const severe = overdue && row.daysRemaining !== null && row.daysRemaining <= SEVERE_DAYS_LATE;
              const style = HEALTH[row.health];
              const scale = Math.max(row.openSeats, row.pipeline, 1);
              const onTrack = Math.max(0, row.pipeline - row.overdueCandidates);
              return (
                <li
                  key={row.mrfId}
                  className={`flex flex-col gap-2 px-3.5 py-3.5 transition-colors hover:bg-navy-soft focus-within:bg-navy-soft motion-reduce:transition-none @2xl:grid @2xl:items-center @2xl:gap-x-4 ${columns}`}
                >
                  <div className="min-w-0">
                    <Link
                      to={linkTo}
                      params={{ mrfId: String(row.mrfId) }}
                      {...(linkState ? { state: linkState as never } : {})}
                      className="block truncate text-sm font-semibold text-navy underline underline-offset-2 decoration-slate-400 hover:decoration-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {row.title}
                    </Link>
                    <span className="block truncate text-xs font-sans text-slate-600">{row.clientName}</span>
                  </div>

                  <div className="text-xs font-sans tabular-nums text-slate-700">
                    <span className="block text-sm text-slate-900">
                      <strong>{row.filled}</strong>/{row.headcount} seats
                    </span>
                    {row.targetFillDate && <span className="block text-slate-600">Target {formatDate(row.targetFillDate)}</span>}
                  </div>

                  {showOwner && (
                    <div className="min-w-0 text-sm font-sans">
                      <span title={owner.full} className={`block truncate ${row.ownerId === null ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                        {owner.label}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 text-xs font-sans text-slate-700">
                    {row.attention ? (
                      <span title={ATTENTION[row.attention].title} className={`inline-block px-1.5 py-0.5 font-semibold ${ATTENTION[row.attention].chip}`}>
                        {ATTENTION[row.attention].label}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="flex h-1.5 w-full max-w-36 overflow-hidden bg-[#E1E6ED]">
                        <span style={{ width: `${(onTrack / scale) * 100}%`, backgroundColor: BAR_ON_TRACK }} />
                        <span style={{ width: `${(row.overdueCandidates / scale) * 100}%`, backgroundColor: WORKLOAD.overdue }} />
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-x-2 tabular-nums">
                      {!row.attention && (
                        <span title={`${row.applicantCount} ${row.applicantCount === 1 ? "applicant" : "applicants"} in all`}>{row.pipeline} in pipeline</span>
                      )}
                      {row.overdueCandidates > 0 && <span className={`font-semibold ${TEXT_LOSS}`}>{row.overdueCandidates} overdue</span>}
                      {row.backoutsInPeriod > 0 && <span className={TEXT_LOSS}>{row.backoutsInPeriod} backed out</span>}
                    </span>
                  </div>

                  {/* On a narrow panel the chip leads the row; in the table it is the last column. */}
                  <div className="order-first flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-sans @2xl:order-none @2xl:flex-col @2xl:items-start @2xl:gap-y-1">
                    <span
                      className={`inline-block whitespace-nowrap px-2 py-0.5 font-semibold tabular-nums ${
                        severe ? "bg-[#B42318] text-white" : style.badge.replace(/border-\S+/g, "")
                      }`}
                    >
                      {overdue ? (
                        <>
                          <span className="sr-only">Overdue: </span>
                          {slaText(row)}
                        </>
                      ) : (
                        style.label
                      )}
                    </span>
                    {!overdue && <span className="tabular-nums text-slate-600">{slaText(row)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="requests" />
      {note && <p id="requests-note" className="scroll-mt-4 border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">{note}</p>}
    </AnalyticsPanel>
  );
});
