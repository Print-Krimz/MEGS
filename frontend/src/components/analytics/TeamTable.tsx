import React, { useMemo, useState } from "react";
import type { TeamRow } from "../../lib/types/analytics.types";
import { formatSampled } from "../../lib/analytics-format";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { TEXT_LOSS, TEXT_AMBER } from "../../lib/chart-palette";
import { PaginationBar } from "./PaginationBar";

interface TeamTableProps {
  rows: TeamRow[];
  selectedRecruiterId?: string;
  onSelectRecruiter: (recruiterId: string | undefined) => void;
  pageSize?: number;
  /** Content only, for use inside a tab. */
  bare?: boolean;
  /** Pre-fills the search, e.g. from outside the table. */
  initialQuery?: string;
  /** One visible line under the tab. */
  subtitle?: string;
}

type SortKey = "name" | "active" | "overdue" | "openRequisitions" | "seats" | "placed" | "backoutRate" | "medianDaysToFill";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Recruiter" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "openRequisitions", label: "Open requests" },
  { key: "seats", label: "Seats filled" },
  { key: "placed", label: "Starts" },
  { key: "backoutRate", label: "Backout rate" },
  { key: "medianDaysToFill", label: "Days to fill" },
];

/** What a column sorts by. null means "no value", which always sorts last. */
const sortValue = (row: TeamRow, key: SortKey): string | number | null => {
  switch (key) {
    case "name":
      return formatRecruiterName(row.name).label.toLowerCase();
    case "overdue":
      // The cell shows verified + estimated, so the sort uses the same total.
      return row.overdue + row.overdueEstimated;
    case "seats":
      return row.fillRate;
    case "backoutRate":
      return row.backoutRate;
    case "medianDaysToFill":
      return row.medianDaysToFill;
    default:
      return row[key];
  }
};

const compare = (a: TeamRow, b: TeamRow, { key, dir }: Sort): number => {
  const x = sortValue(a, key);
  const y = sortValue(b, key);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  const order = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
  return dir === "asc" ? order : -order;
};

const TD = "px-3 py-2 text-right tabular-nums whitespace-nowrap text-slate-700";

export const TeamTable = React.memo(function TeamTable({
  rows,
  selectedRecruiterId,
  onSelectRecruiter,
  pageSize = 10,
  bare = false,
  initialQuery = "",
  subtitle = "Select a name to filter the whole page to that recruiter. Active, Overdue, Open requests and Seats filled are right now. Starts, Backout rate and Days to fill use the dates above.",
}: TeamTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  // null keeps the order the server sent, which is Overdue, highest first.
  const [sort, setSort] = useState<Sort | null>(null);
  const shown: Sort = sort ?? { key: "overdue", dir: "desc" };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const kept = rows.filter((r) => {
      // A selected recruiter always stays visible so the filter can be undone.
      if (r.recruiterId === selectedRecruiterId) return true;
      return !needle || r.name.toLowerCase().includes(needle);
    });
    // Array.sort is stable, so ties keep the server order.
    return sort ? [...kept].sort((a, b) => compare(a, b, sort)) : kept;
  }, [rows, query, selectedRecruiterId, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const sortBy = (key: SortKey) => {
    setSort(shown.key === key ? { key, dir: shown.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" });
    setPage(1);
  };

  return (
    <AnalyticsPanel tone="reports" id="recruiter-table" title="Recruiters" subtitle={subtitle} bare={bare}>
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
        <p className="p-6 text-center text-xs text-slate-500 font-sans">{rows.length === 0 ? "No recruiters in this view." : "No match."}</p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_var(--color-slate-200)]">
              <tr>
                {COLUMNS.map((col) => {
                  const active = shown.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (shown.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={`px-3 py-1 text-xs font-semibold text-slate-600 whitespace-nowrap ${col.key === "name" ? "text-left min-w-40" : "text-right"}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(col.key)}
                        className="min-h-9 inline-flex items-center gap-1 font-semibold hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {col.label}
                        <span aria-hidden="true" className={active ? "text-slate-900" : "text-slate-400"}>
                          {active ? (shown.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const selected = row.recruiterId === selectedRecruiterId;
                const label = formatRecruiterName(row.name).label;
                const action = selected ? "Show all recruiters" : "Filter the page to this recruiter";
                return (
                  <tr key={row.recruiterId} className={selected ? "bg-navy-soft" : undefined}>
                    <th scope="row" className="px-3 py-2 text-left font-sans font-medium whitespace-nowrap">
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${label}. ${action}`}
                        title={action}
                        onClick={() => onSelectRecruiter(selected ? undefined : row.recruiterId)}
                        className="min-h-9 text-left text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {label}
                      </button>
                    </th>
                    <td className={`${TD} font-semibold text-slate-950`}>{row.active}</td>
                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${row.overdue + row.overdueEstimated > 0 ? `font-bold ${TEXT_LOSS}` : "text-slate-500"}`}>
                      {row.overdue}
                      {row.overdueEstimated > 0 && <span className={`font-normal ${TEXT_AMBER}`}> + {row.overdueEstimated} estimated</span>}
                    </td>
                    <td className={TD}>{row.openRequisitions}</td>
                    <td className={TD}>
                      {formatSampled(row.fillRate, row.requestedSeats, "%")}
                      {row.requestedSeats > 0 && (
                        <span className="block text-xs text-slate-500">
                          {row.filledSeats} of {row.requestedSeats}
                        </span>
                      )}
                    </td>
                    <td className={TD}>{row.placed}</td>
                    <td className={TD}>{formatSampled(row.backoutRate, row.backoutRateBase, "%")}</td>
                    <td className={TD}>{formatSampled(row.medianDaysToFill, row.daysToFillSample, "days")}</td>
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
