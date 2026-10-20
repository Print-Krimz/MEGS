import React, { useMemo, useState } from "react";
import type { TeamRow } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { PaginationBar } from "./PaginationBar";

interface TeamTableProps {
  rows: TeamRow[];
  rangeLabel: string;
  selectedRecruiterId?: string;
  onSelectRecruiter: (recruiterId: string | undefined) => void;
  pageSize?: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** Pre-fills the search, e.g. from outside the table. */
  initialQuery?: string;
}

const TH = "px-3 py-2 text-right text-xs font-semibold text-slate-600 whitespace-nowrap";

export const TeamTable = React.memo(function TeamTable({ rows, rangeLabel, selectedRecruiterId, onSelectRecruiter, pageSize = 10, bare = false, initialQuery = "" }: TeamTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((r) => {
      // A selected recruiter always stays visible so the filter can be undone.
      if (r.recruiterId === selectedRecruiterId) return true;
      return !needle || `${r.name} ${formatRecruiterName(r.name).label}`.toLowerCase().includes(needle);
    });
  }, [rows, query, selectedRecruiterId]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AnalyticsPanel
      id="recruiter-table"
      title="Recruiter workload and results"
      subtitle={`Select a recruiter to filter the whole page. Active, overdue, open requests and seats are as of today. Sent, started, backed out and days to fill cover ${rangeLabel}.`}
      bare={bare}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-3.5 py-2.5">
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <span className="text-xs font-semibold text-slate-600">Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Recruiter name"
            className="min-h-9 w-52 border border-slate-300 bg-white px-2.5 text-sm placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
      </div>

      {pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">
          {rows.length === 0 ? "No recruiter has candidates or open requests in this view." : "No recruiter matches the search."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-slate-600 min-w-40">
                  Recruiter
                </th>
                <th scope="col" className={TH}>
                  Active
                </th>
                <th scope="col" className={TH}>
                  Overdue
                </th>
                <th scope="col" className={TH}>
                  Open requests
                </th>
                <th scope="col" className={TH}>
                  Seats filled
                </th>
                <th scope="col" className={TH}>
                  Sent to client
                </th>
                <th scope="col" className={TH}>
                  Started
                </th>
                <th scope="col" className={TH}>
                  Backed out
                </th>
                <th scope="col" className={TH}>
                  Backout %
                </th>
                <th scope="col" className={TH}>
                  Days to fill
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const selected = row.recruiterId === selectedRecruiterId;
                return (
                  <tr key={row.recruiterId} className={selected ? "bg-navy-soft" : undefined}>
                    <th scope="row" className="px-3 py-2 text-left font-sans font-medium whitespace-nowrap">
                      <button
                          type="button"
                          aria-pressed={selected}
                          title={formatRecruiterName(row.name).full}
                          onClick={() => onSelectRecruiter(selected ? undefined : row.recruiterId)}
                          className="text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus text-left"
                        >
                          {formatRecruiterName(row.name).label}
                        </button>
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold text-slate-950">{row.active}</td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${row.overdue > 0 ? "font-bold text-rose-700" : "text-slate-500"}`}>
                      {row.overdue}
                      {row.overdueEstimated > 0 && (
                        <span className="block text-[11px] font-normal text-amber-800">+{row.overdueEstimated} by age only</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">{row.openRequisitions}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {row.requestedSeats === 0 ? (
                        "—"
                      ) : (
                        <>
                          {row.filledSeats} of {row.requestedSeats}
                          <span className="block text-[11px] text-slate-500">{row.fillRate}%</span>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">{row.sentToClient}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {row.placed}
                      {row.redeployStarts > 0 && (
                        <span className="block text-[11px] text-slate-500">
                          {row.newStarts} new, {row.redeployStarts} redeployed
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${row.backouts > 0 ? "text-rose-700" : "text-slate-500"}`}>
                      {row.backouts}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {row.placed + row.backouts === 0 ? "—" : `${row.backoutRate}%`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700">
                      {row.medianDaysToFill === null ? "—" : row.medianDaysToFill}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="recruiters" />
    </AnalyticsPanel>
  );
});
