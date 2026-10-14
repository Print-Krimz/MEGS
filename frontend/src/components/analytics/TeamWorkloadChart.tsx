import React, { useMemo, useState } from "react";
import type { TeamRow } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface TeamWorkloadChartProps {
  rows: TeamRow[];
  selectedRecruiterId?: string;
  onSelectRecruiter: (recruiterId: string | undefined) => void;
  /** How many recruiters to draw. The recruiters tab lists everyone. */
  limit?: number;
}

type Mode = "load" | "capacity";

const MODES: { key: Mode; label: string }[] = [
  { key: "load", label: "Most overloaded" },
  { key: "capacity", label: "Available capacity" },
];

/**
 * A compact comparison for balancing work: one line per recruiter, showing how much they carry (active candidates,
 * split by overdue) and how many of their seats are filled. Sorted by who is most overloaded, or by who has the
 * least on their plate and could take on unassigned work. Never sorted by results, because a recruiter with more
 * seats assigned will always show more starts.
 */
export const TeamWorkloadChart: React.FC<TeamWorkloadChartProps> = ({ rows, selectedRecruiterId, onSelectRecruiter, limit = 8 }) => {
  const [mode, setMode] = useState<Mode>("load");

  const sorted = useMemo(() => {
    const byName = (a: TeamRow, b: TeamRow) => a.name.localeCompare(b.name);
    return [...rows].sort(
      mode === "load"
        ? (a, b) => b.overdue + b.overdueEstimated - (a.overdue + a.overdueEstimated) || b.active - a.active || byName(a, b)
        : (a, b) => a.active - b.active || a.overdue + a.overdueEstimated - (b.overdue + b.overdueEstimated) || byName(a, b)
    );
  }, [rows, mode]);
  const shown = sorted.slice(0, limit);
  const maxActive = Math.max(1, ...shown.map((r) => r.active));

  return (
    <AnalyticsPanel
      id="team-workload"
      title="Workload compared"
      subtitle={
        mode === "load"
          ? "Recruiters with the most overdue candidates first. Read seats filled next to the workload, not instead of it."
          : "Recruiters with the fewest active candidates first. They are the ones who can take on work no one owns."
      }
      aside={
        <div role="group" aria-label="Sort recruiters" className="flex">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={mode === m.key}
              onClick={() => setMode(m.key)}
              className={`min-h-8 px-2 text-[11px] font-sans font-semibold border first:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${
                mode === m.key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      }
    >
      {shown.length === 0 ? (
        <p className="p-6 text-center text-xs text-slate-500 font-sans">No recruiter has candidates or open requests in this view.</p>
      ) : (
        <div className="p-3.5">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-teal-600" aria-hidden="true" />
              Within limit
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-rose-600" aria-hidden="true" />
              Overdue
            </li>
            <li className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 bg-amber-400" aria-hidden="true" />
              Overdue by age only
            </li>
          </ul>
          <ul className="divide-y divide-slate-100">
            {shown.map((row) => {
              const onTime = Math.max(0, row.active - row.overdue - row.overdueEstimated);
              const selected = row.recruiterId === selectedRecruiterId;
              const who = formatRecruiterName(row.name);
              const seats = row.requestedSeats === 0 ? "no seats" : `${row.filledSeats}/${row.requestedSeats} seats (${Math.round(row.fillRate)}%)`;
              const summary = `${who.label}: ${row.active} active candidates, ${row.overdue} overdue, ${row.overdueEstimated} overdue by application age only. ${row.filledSeats} of ${row.requestedSeats} seats filled.`;
              return (
                <li
                  key={row.recruiterId}
                  aria-label={summary}
                  className={`grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5 ${selected ? "bg-teal-50 -mx-1.5 px-1.5" : ""}`}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectRecruiter(selected ? undefined : row.recruiterId)}
                    className="truncate text-left text-xs font-semibold font-sans text-[#0B315D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
                    title={who.full ?? who.label}
                  >
                    {who.label}
                  </button>
                  <div className="h-3 bg-slate-100" aria-hidden="true">
                    <div className="flex h-full" style={{ width: `${(row.active / maxActive) * 100}%` }}>
                      {onTime > 0 && <div className="bg-teal-600" style={{ width: `${(onTime / row.active) * 100}%` }} />}
                      {row.overdue > 0 && <div className="bg-rose-600" style={{ width: `${(row.overdue / row.active) * 100}%` }} />}
                      {row.overdueEstimated > 0 && <div className="bg-amber-400" style={{ width: `${(row.overdueEstimated / row.active) * 100}%` }} />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-700 font-sans tabular-nums text-right whitespace-nowrap">
                    <strong>{row.active}</strong> active
                    {row.overdue > 0 && <span className="text-rose-700 font-semibold"> · {row.overdue} overdue</span>}
                    <span className="hidden sm:inline text-slate-600"> · {seats}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500 font-sans tabular-nums">
            {mode === "load" ? "Most overloaded" : "Most available"} {shown.length} of {rows.length}. The All recruiters tab lists everyone.
          </p>
        </div>
      )}
    </AnalyticsPanel>
  );
};
