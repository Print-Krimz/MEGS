import React, { useMemo, useState } from "react";
import type { TeamRow } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { NEUTRAL_MARK, TEXT_LOSS } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { BarMark, DataTableToggle } from "./chart-primitives";

interface TeamWorkloadChartProps {
  rows: TeamRow[];
  selectedRecruiterId?: string;
  onSelectRecruiter: (recruiterId: string | undefined) => void;
  /** How many recruiters to draw. The rest are counted in a note. */
  limit?: number;
}

type Sort = "overdue" | "least";

const SORTS: { key: Sort; label: string }[] = [
  { key: "overdue", label: "Most overdue" },
  { key: "least", label: "Least busy" },
];

const lateOf = (r: TeamRow) => r.overdue + r.overdueEstimated;
const byName = (a: TeamRow, b: TeamRow) => a.name.localeCompare(b.name);

/**
 * One plain bar per recruiter: active candidates, scaled to the busiest recruiter shown. Overdue is red text only, with
 * overdue counted from application age only folded in; the bar's name and tooltip say so.
 * "Most overdue" shows who needs help; "Least busy" shows who can take unassigned work, which the first sort cannot show.
 * Never sorted by results: a recruiter with more seats will always show more starts.
 */
export const TeamWorkloadChart: React.FC<TeamWorkloadChartProps> = ({ rows, selectedRecruiterId, onSelectRecruiter, limit = 6 }) => {
  const [sort, setSort] = useState<Sort>("overdue");

  const sorted = useMemo(
    () =>
      [...rows].sort(
        sort === "overdue"
          ? (a, b) => lateOf(b) - lateOf(a) || b.active - a.active || byName(a, b)
          : (a, b) => a.active - b.active || lateOf(a) - lateOf(b) || byName(a, b)
      ),
    [rows, sort]
  );
  const shown = sorted.slice(0, limit);
  const hidden = Math.max(0, sorted.length - shown.length);
  const maxActive = Math.max(1, ...shown.map((r) => r.active));

  return (
    <AnalyticsPanel
      id="team-workload"
      title="Team workload"
      subtitle="Active candidates per recruiter. The red part is past its stage limit. Part of it may be counted from application age only."
      className="h-full flex flex-col"
      aside={
        <div role="group" aria-label="Sort recruiters" className="flex">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={sort === s.key}
              onClick={() => setSort(s.key)}
              className={`min-h-8 px-2 text-xs font-sans font-semibold border first:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                sort === s.key ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No active candidates.</p>
      ) : (
        <div className="p-3.5 flex-1">
          <ul className="divide-y divide-slate-100">
            {shown.map((row, i) => {
              const late = lateOf(row);
              const selected = row.recruiterId === selectedRecruiterId;
              const who = formatRecruiterName(row.name);
              const detail = `${late} overdue${row.overdueEstimated > 0 ? `, ${row.overdueEstimated} of them by application age only` : ""}`;
              return (
                <li
                  key={row.recruiterId}
                  className={`grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-x-3 py-2 ${selected ? "bg-slate-50 -mx-1.5 px-1.5" : ""}`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectRecruiter(selected ? undefined : row.recruiterId)}
                    className="truncate text-left text-xs font-semibold font-sans text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    title={who.full ?? who.label}
                  >
                    {who.label}
                  </button>
                  <BarMark label={`${who.label}, active`} value={row.active} max={maxActive} pct={detail} color={NEUTRAL_MARK} index={i} />
                  <span className="whitespace-nowrap text-right text-xs font-sans tabular-nums text-slate-700">
                    <strong className="text-slate-950">{row.active}</strong> active
                    {late > 0 && <span className={`font-semibold ${TEXT_LOSS}`}> · {late} overdue</span>}
                  </span>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && <p className="mt-2 text-xs text-slate-500 font-sans">+{hidden} more in Recruiters</p>}
          <DataTableToggle
            caption="Workload by recruiter"
            columns={["Recruiter", "Active", "Overdue", "By age only", "Seats filled", "Seats requested"]}
            rows={sorted.map((r) => ({ key: r.recruiterId, cells: [formatRecruiterName(r.name).label, r.active, r.overdue, r.overdueEstimated, r.filledSeats, r.requestedSeats] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
