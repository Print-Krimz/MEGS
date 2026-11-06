import React, { useMemo, useState } from "react";
import type { TeamRow, UnassignedWork } from "../../lib/types/analytics.types";
import { sampleNote } from "../../lib/analytics-format";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { TEXT_AMBER, TEXT_GOOD, TEXT_LOSS } from "../../lib/chart-palette";
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
  /** Filters the page to this recruiter and opens their overdue candidates. Without it the overdue count is plain text. */
  onViewOverdue?: (recruiterId: string) => void;
  /** Unassigned applicants and client requests not yet assigned to a recruiter. */
  unassigned?: UnassignedWork;
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
      // Sorts by the stored name, not the shown label, so an email sorts by the whole address.
      return row.name.trim().toLowerCase();
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

const TD = "px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-700 align-top";
const SUB = "block text-xs font-normal";

/** A recruiter flag: what it says and how it reads (red = act now, amber = watch, green = strong). */
type Flag = { text: string; tone: "bad" | "watch" | "good" };
const FLAG_TONE = {
  bad: `bg-[#FDF1F2] ${TEXT_LOSS}`,
  watch: `bg-[#FFF4DC] ${TEXT_AMBER}`,
  good: `bg-[#EAF6EE] ${TEXT_GOOD}`,
} as const;

/**
 * Flags compare one recruiter with the rest of the team, so they only appear for a team of three or more.
 * The cut-offs are deliberately plain: 1.5x the team average for load, a 40% overdue share, half the team fill rate,
 * 1.5x the team backout rate (and at least 20%), and a quarter faster or slower than the typical days to fill.
 */
const benchmarks = (rows: TeamRow[]) => {
  const comparable = rows.length >= 3;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);
  const seats = rows.reduce((t, r) => t + r.requestedSeats, 0);
  const filled = rows.reduce((t, r) => t + r.filledSeats, 0);
  const lost = rows.reduce((t, r) => t + r.backouts, 0);
  const base = rows.reduce((t, r) => t + r.backoutRateBase, 0);
  const days = rows.map((r) => r.medianDaysToFill).filter((n): n is number => n !== null).sort((x, y) => x - y);
  const mid = days.length ? (days.length % 2 ? days[(days.length - 1) / 2] : (days[days.length / 2 - 1] + days[days.length / 2]) / 2) : null;
  return {
    comparable,
    active: avg(rows.map((r) => r.active)),
    fill: seats > 0 ? (filled / seats) * 100 : null,
    backout: base > 0 ? (lost / base) * 100 : null,
    days: mid,
  };
};
type Benchmarks = ReturnType<typeof benchmarks>;

const flagsFor = (row: TeamRow, bench: Benchmarks) => {
  const out: { load?: Flag; overdue?: Flag; fill?: Flag; backout?: Flag; days?: Flag } = {};
  if (!bench.comparable) return out;
  const late = row.overdue + row.overdueEstimated;
  if (bench.active !== null && row.active >= 10 && row.active > bench.active * 1.5) out.load = { text: "High load", tone: "watch" };
  if (late >= 3 && row.active > 0 && late / row.active >= 0.4) out.overdue = { text: "High overdue", tone: "bad" };
  if (row.fillRate !== null && bench.fill !== null && row.fillRate < bench.fill * 0.5) out.fill = { text: "Low fill", tone: "watch" };
  if (row.backoutRate !== null && bench.backout !== null && row.backoutRate >= Math.max(20, bench.backout * 1.5)) out.backout = { text: "High backouts", tone: "bad" };
  if (row.medianDaysToFill !== null && bench.days !== null && Math.abs(row.medianDaysToFill - bench.days) >= 1) {
    if (row.medianDaysToFill <= bench.days * 0.75) out.days = { text: "Fast", tone: "good" };
    else if (row.medianDaysToFill >= bench.days * 1.25) out.days = { text: "Slow", tone: "bad" };
  }
  return out;
};

/** A hidden rate: "—", with how few cases stood behind it when there were some. */
const NoValue: React.FC<{ n: number }> = ({ n }) => (
  <>
    <span aria-hidden="true" className="text-slate-600">—</span>
    {n === 0 ? <span className="sr-only">{sampleNote(0)}</span> : <span className={`${SUB} text-slate-600`}>{sampleNote(n)}</span>}
  </>
);

const FlagText: React.FC<{ flag?: Flag }> = ({ flag }) =>
  flag ? <span className={`mt-0.5 inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${FLAG_TONE[flag.tone]}`}>{flag.text}</span> : null;

export const TeamTable = React.memo(function TeamTable({
  rows,
  selectedRecruiterId,
  onSelectRecruiter,
  pageSize = 10,
  bare = false,
  initialQuery = "",
  subtitle = "Select a row to filter the whole page to that recruiter. Active, Overdue, Open requests and Seats filled are right now. Starts, Backout rate and Days to fill use the dates above.",
  onViewOverdue,
  unassigned,
}: TeamTableProps) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  // Opens on Overdue, highest first, as the arrow shows.
  const [sort, setSort] = useState<Sort>({ key: "overdue", dir: "desc" });
  const shown = sort;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const kept = rows.filter((r) => {
      // A selected recruiter always stays visible so the filter can be undone.
      if (r.recruiterId === selectedRecruiterId) return true;
      return !needle || r.name.toLowerCase().includes(needle);
    });
    // Array.sort is stable, so ties keep the server order.
    return [...kept].sort((a, b) => compare(a, b, sort));
  }, [rows, query, selectedRecruiterId, sort]);

  const bench = useMemo(() => benchmarks(rows), [rows]);

  const totals = useMemo(() => {
    const active = rows.reduce((t, r) => t + r.active, 0);
    const overdue = rows.reduce((t, r) => t + r.overdue + r.overdueEstimated, 0);
    const filled = rows.reduce((t, r) => t + r.filledSeats, 0);
    const seats = rows.reduce((t, r) => t + r.requestedSeats, 0);
    const starts = rows.reduce((t, r) => t + r.placed, 0);
    return { active, overdue, filled, seats, starts };
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const sortBy = (key: SortKey) => {
    setSort(shown.key === key ? { key, dir: shown.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "name" ? "asc" : "desc" });
    setPage(1);
  };

  const hasUnassigned = Boolean(unassigned && (unassigned.applicants > 0 || unassigned.requests > 0));

  return (
    <AnalyticsPanel tone="reports" id="recruiter-table" title="Recruiters" subtitle={subtitle} bare={bare}>
      {rows.length > 0 && (
        <div
          aria-hidden="true"
          className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50/85 px-4 py-2.5 text-xs font-sans sm:grid-cols-4"
        >
          <div className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)]">
            <span className="block text-[11px] font-medium text-slate-500">Team active pipeline</span>
            <span className="text-sm font-bold tabular-nums text-slate-950">{totals.active}</span>
          </div>
          <div className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)]">
            <span className="block text-[11px] font-medium text-slate-500">Team overdue</span>
            <span className={`text-sm font-bold tabular-nums ${totals.overdue > 0 ? TEXT_LOSS : "text-slate-700"}`}>{totals.overdue}</span>
          </div>
          <div className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)]">
            <span className="block text-[11px] font-medium text-slate-500">Assigned seats filled</span>
            <span className="text-sm font-bold tabular-nums text-navy">
              {totals.filled} / {totals.seats}
            </span>
          </div>
          <div className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 shadow-[0_1px_1px_0_rgb(15_23_42/0.03)]">
            <span className="block text-[11px] font-medium text-slate-500">Team starts</span>
            <span className="text-sm font-bold tabular-nums text-[#1B6B3A]">{totals.starts}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-slate-200 bg-white px-4 py-2.5">
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
            className="min-h-11 md:min-h-9 w-56 rounded-md border border-slate-300 bg-white px-2.5 text-sm shadow-[0_1px_1px_0_rgb(15_23_42/0.03)] placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
        <p className="text-xs font-sans text-slate-600">
          {bench.comparable
            ? "Flags compare each recruiter with the team average."
            : "Flags need at least three recruiters to compare."}
        </p>
      </div>

      {pageRows.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-600 font-sans">{rows.length === 0 ? "No recruiters in this view." : "No match."}</p>
      ) : (
        <div className="relative max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[50rem] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100/95 shadow-[inset_0_-1px_0_var(--color-ta-line)]">
              <tr>
                {COLUMNS.map((col) => {
                  const active = shown.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (shown.dir === "asc" ? "ascending" : "descending") : undefined}
                      className={`px-3 py-1 text-xs font-semibold text-slate-700 whitespace-nowrap ${col.key === "name" ? "text-left min-w-48" : "text-right"}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(col.key)}
                        className="min-h-11 md:min-h-9 inline-flex items-center gap-1 font-semibold hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {col.label}
                        <span aria-hidden="true" className={`text-xs ${active ? "text-navy font-bold" : "text-slate-500"}`}>
                          {active ? (shown.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/90">
              {pageRows.map((row) => {
                const selected = row.recruiterId === selectedRecruiterId;
                const { label, email } = formatRecruiterName(row.name);
                const action = selected ? "Show all recruiters" : "Filter the page to this recruiter";
                const spokenName = email ? `${label} ${email}` : label;
                const late = row.overdue + row.overdueEstimated;
                const flag = flagsFor(row, bench);
                const toggle = () => onSelectRecruiter(selected ? undefined : row.recruiterId);
                const seatPct = row.requestedSeats > 0 ? Math.min(100, Math.round((row.filledSeats / row.requestedSeats) * 100)) : 0;
                return (
                  // The whole row is a click target (the name button is the keyboard route), because choosing a recruiter filters the page.
                  <tr
                    key={row.recruiterId}
                    onClick={toggle}
                    className={`cursor-pointer transition-colors hover:bg-navy-soft motion-reduce:transition-none ${selected ? "bg-navy-soft outline outline-1 -outline-offset-1 outline-navy" : ""}`}
                  >
                    <th scope="row" className="px-3 py-3 text-left font-sans font-semibold whitespace-nowrap align-top">
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${spokenName}. ${action}`}
                        title={action}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle();
                        }}
                        className="min-h-11 text-left text-sm font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus md:min-h-0 md:py-0.5"
                      >
                        {label}{email && " "}
                        {email && <span className="block text-xs font-normal text-slate-600 truncate">{email}</span>}
                      </button>
                    </th>
                    <td className={`${TD} font-semibold text-slate-950`}>
                      {row.active}
                      <FlagText flag={flag.load} />
                    </td>
                    <td className={`${TD} ${late > 0 ? "" : "text-slate-600"}`}>
                      {late === 0 ? (
                        "0"
                      ) : onViewOverdue ? (
                        <button
                          type="button"
                          aria-label={`${row.overdue} overdue${row.overdueEstimated > 0 ? ` +${row.overdueEstimated} projected` : ""}. View ${label}'s overdue candidates`}
                          title="View their overdue candidates"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOverdue(row.recruiterId);
                          }}
                          className={`group min-h-11 md:min-h-9 text-right font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${TEXT_LOSS}`}
                        >
                          <span className="underline decoration-slate-300 underline-offset-2 group-hover:decoration-current">{row.overdue} overdue</span>
                          {row.overdueEstimated > 0 && <span className={`${SUB} font-normal ${TEXT_AMBER}`}>+{row.overdueEstimated} projected</span>}
                        </button>
                      ) : (
                        <span className={`font-bold ${TEXT_LOSS}`}>
                          {row.overdue} overdue
                          {row.overdueEstimated > 0 && <span className={`${SUB} font-normal ${TEXT_AMBER}`}>+{row.overdueEstimated} projected</span>}
                        </span>
                      )}
                      <FlagText flag={flag.overdue} />
                    </td>
                    <td className={TD}>{row.openRequisitions}</td>
                    <td className={TD}>
                      {row.requestedSeats === 0 ? (
                        <span aria-hidden="true" className="text-slate-600">—</span>
                      ) : (
                        <>
                          <span className="text-slate-950">
                            <strong>{row.filledSeats}</strong> / {row.requestedSeats} seats
                          </span>
                          {row.fillRate === null ? (
                            <span className={`${SUB} text-slate-600`}>{sampleNote(row.requestedSeats)}</span>
                          ) : (
                            <span className={`${SUB} text-slate-600`}>{row.fillRate}%</span>
                          )}
                          <div aria-hidden="true" className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-200/90">
                            <div className="h-full rounded-full bg-navy" style={{ width: `${seatPct}%` }} />
                          </div>
                        </>
                      )}
                      {row.requestedSeats === 0 && <span className="sr-only">{sampleNote(0)}</span>}
                      <FlagText flag={flag.fill} />
                    </td>
                    <td className={TD}>{row.placed}</td>
                    <td className={TD}>
                      {row.backoutRate === null ? (
                        <NoValue n={row.backoutRateBase} />
                      ) : (
                        <>
                          {row.backoutRate}%
                          <FlagText flag={flag.backout} />
                        </>
                      )}
                    </td>
                    <td className={TD}>
                      {row.medianDaysToFill === null ? (
                        <NoValue n={row.daysToFillSample} />
                      ) : (
                        <>
                          {row.medianDaysToFill} {row.medianDaysToFill === 1 ? "day" : "days"}
                          <FlagText flag={flag.days} />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasUnassigned && unassigned && (
        <div className="border-t border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs font-sans text-slate-700 tabular-nums">
          <span className="font-semibold text-slate-900">Unassigned work:</span>{" "}
          {unassigned.applicants} active {unassigned.applicants === 1 ? "applicant" : "applicants"}
          {unassigned.overdue + unassigned.overdueEstimated > 0 && (
            <span className={`font-semibold ${TEXT_LOSS}`}>
              {` (${unassigned.overdue + unassigned.overdueEstimated} overdue)`}
            </span>
          )}
          {" · "}
          {unassigned.requests} open {unassigned.requests === 1 ? "request" : "requests"} ({unassigned.requestedSeats} {unassigned.requestedSeats === 1 ? "seat" : "seats"})
        </div>
      )}
      <PaginationBar page={currentPage} pageSize={pageSize} total={visible.length} onPageChange={setPage} noun="recruiters" />
    </AnalyticsPanel>
  );
});
