import React, { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { RequestRow } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { formatDate } from "../../lib/utils";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { PaginationBar } from "./PaginationBar";

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
}

export type RequestHealthFilter = "ALL" | "NONE" | "UNOWNED" | RequestRow["health"];

const HEALTH: Record<RequestRow["health"], { label: string; badge: string; bar: string }> = {
  OVERDUE: { label: "Overdue", badge: "bg-rose-50 text-rose-800 border-rose-300", bar: "bg-rose-600" },
  AT_RISK: { label: "At risk", badge: "bg-amber-50 text-amber-800 border-amber-300", bar: "bg-amber-500" },
  ON_TRACK: { label: "On track", badge: "bg-emerald-50 text-emerald-800 border-emerald-300", bar: "bg-teal-600" },
  FILLED: { label: "Filled", badge: "bg-slate-100 text-slate-700 border-slate-300", bar: "bg-slate-500" },
};

const ATTENTION: Record<Exclude<RequestRow["attention"], null>, { label: string; badge: string }> = {
  NO_OPENING: { label: "No opening posted", badge: "bg-amber-50 text-amber-900 border-amber-300" },
  NO_APPLICANTS: { label: "No applicants yet", badge: "bg-amber-50 text-amber-900 border-amber-300" },
  FIRST_STAGE_ONLY: { label: "Nobody past first review", badge: "bg-slate-100 text-slate-800 border-slate-300" },
};

const hasNoCandidates = (r: RequestRow) => r.attention === "NO_OPENING" || r.attention === "NO_APPLICANTS";
const isUnowned = (r: RequestRow) => r.ownerId === null && r.health !== "FILLED";

/** The short "how late or how soon" text. The target date is in the tooltip. */
const slaText = (row: RequestRow): string => {
  if (!row.targetFillDate || row.daysRemaining === null) return "No target date";
  if (row.daysRemaining < 0) return `${Math.abs(row.daysRemaining)} days late`;
  if (row.daysRemaining === 0) return "Due today";
  return `Due in ${row.daysRemaining} days`;
};

const TH = "px-3 py-2 text-left text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap";

/** Open client requests, most urgent first, as one row each with a status filter, search and paging. */
export const RequestProgressList: React.FC<RequestProgressListProps> = ({
  rows,
  linkTo,
  showOwner = true,
  note,
  pageSize = 10,
  bare = false,
  focus,
}) => {
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
    const c: Record<RequestHealthFilter, number> = { ALL: rows.length, NONE: 0, UNOWNED: 0, OVERDUE: 0, AT_RISK: 0, ON_TRACK: 0, FILLED: 0 };
    for (const r of rows) {
      c[r.health]++;
      if (hasNoCandidates(r)) c.NONE++;
      if (isUnowned(r)) c.UNOWNED++;
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
    // Only an Admin sees requests with no owner, and only when there are some.
    ...(showOwner && counts.UNOWNED > 0 ? [{ key: "UNOWNED" as const, label: "No owner" }] : []),
  ];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesHealth =
        health === "ALL" ||
        (health === "NONE" ? hasNoCandidates(r) : health === "UNOWNED" ? isUnowned(r) : r.health === health);
      return matchesHealth && (!needle || `${r.title} ${r.clientName} ${r.ownerName} ${formatRecruiterName(r.ownerName).label}`.toLowerCase().includes(needle));
    });
  }, [rows, health, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AnalyticsPanel
      id="client-requests"
      title="Client requests"
      subtitle="Open requests, plus any filled in this period, most urgent first. A seat counts as filled while a placement holds it."
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
                className={`min-h-9 px-2.5 text-xs font-semibold border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${
                  health === f.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {f.label} <span className="tabular-nums font-normal">{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <span className="font-mono font-bold uppercase tracking-wider text-[11px] text-slate-500">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder={showOwner ? "Request, client or recruiter" : "Request or client"}
              className="min-h-9 w-56 border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
            />
          </label>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">There are no client requests in this view.</p>
      ) : pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No request matches. Change the status or clear the search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full sm:min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className={TH}>Role and client</th>
                {showOwner && (
                  <th scope="col" className={`${TH} hidden sm:table-cell`}>Recruiter</th>
                )}
                <th scope="col" className={TH}>Seats filled</th>
                <th scope="col" className={`${TH} hidden sm:table-cell`}>Pipeline</th>
                <th scope="col" className={TH}>Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const style = HEALTH[row.health];
                const pct = row.headcount > 0 ? Math.min(100, Math.round((row.filled / row.headcount) * 100)) : 0;
                const owner = formatRecruiterName(row.ownerName);
                const due = row.targetFillDate ? `Target ${formatDate(row.targetFillDate)}` : "No target date";
                return (
                  <tr key={row.mrfId} className="align-top">
                    <th scope="row" className="px-3 py-2 text-left font-sans font-normal max-w-64">
                      <Link
                        to={linkTo}
                        params={{ mrfId: String(row.mrfId) }}
                        className="block truncate text-sm font-semibold text-[#0B315D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                      >
                        {row.title}
                      </Link>
                      <span className="block truncate text-xs text-slate-600">{row.clientName}</span>
                      {/* On a phone the recruiter and pipeline columns are folded into this cell. */}
                      <span className="mt-0.5 block text-xs text-slate-700 sm:hidden">
                        {showOwner && <>{row.ownerId === null ? "No owner" : owner.label} · </>}
                        {row.attention ? ATTENTION[row.attention].label : `${row.pipeline} for ${row.openSeats} open`}
                        {row.overdueCandidates > 0 && `, ${row.overdueCandidates} overdue`}
                      </span>
                    </th>
                    {showOwner && (
                      <td className="hidden sm:table-cell px-3 py-2 text-xs font-sans text-slate-800 whitespace-nowrap" title={owner.full}>
                        {row.ownerId === null ? <span className="font-semibold text-amber-800">No owner</span> : owner.label}
                      </td>
                    )}
                    <td className="px-3 py-2 min-w-32">
                      <span className="text-xs tabular-nums text-slate-800">
                        <strong>{row.filled}</strong> of <strong>{row.headcount}</strong> seats
                      </span>
                      <div
                        className="mt-1 h-1.5 w-28 bg-slate-100"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={row.headcount}
                        aria-valuenow={Math.min(row.filled, row.headcount)}
                        aria-label={`${row.title}: ${row.filled} of ${row.headcount} seats filled`}
                      >
                        <div className={`h-full ${style.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2 text-xs font-sans text-slate-700">
                      {row.attention ? (
                        <span className={`inline-block border px-1.5 py-0.5 font-semibold ${ATTENTION[row.attention].badge}`}>{ATTENTION[row.attention].label}</span>
                      ) : (
                        <span className="tabular-nums" title={`${row.applicantCount} ${row.applicantCount === 1 ? "applicant" : "applicants"} in all`}>
                          <strong>{row.pipeline}</strong> for {row.openSeats} open
                        </span>
                      )}
                      {row.overdueCandidates > 0 && (
                        <span className="block text-rose-700 tabular-nums">
                          {row.overdueCandidates} overdue {row.overdueCandidates === 1 ? "candidate" : "candidates"}
                        </span>
                      )}
                      {row.backoutsInPeriod > 0 && <span className="block text-rose-700 tabular-nums">{row.backoutsInPeriod} backed out</span>}
                    </td>
                    <td className="px-3 py-2 text-xs font-sans whitespace-nowrap" title={due}>
                      <span className={`inline-block border px-1.5 py-0.5 text-[11px] font-mono font-bold uppercase ${style.badge}`}>{style.label}</span>
                      <span className={`block mt-0.5 tabular-nums ${row.health === "OVERDUE" ? "text-rose-700 font-semibold" : "text-slate-600"}`}>{slaText(row)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="requests" />
      {note && <p id="requests-note" className="scroll-mt-4 border-t border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">{note}</p>}
    </AnalyticsPanel>
  );
};
