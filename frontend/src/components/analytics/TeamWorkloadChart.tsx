import React, { useMemo, useState } from "react";
import type { TeamRow } from "../../lib/types/analytics.types";
import { formatRecruiterName } from "../../lib/recruiter-label";
import { TEXT_LOSS, WORKLOAD } from "../../lib/chart-palette";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { ChartLegend, DataTableToggle, StackedBar } from "./chart-primitives";

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
              className={`min-h-8 px-2 text-[11px] font-sans font-semibold border first:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                mode === m.key ? "bg-navy text-white border-navy" : "bg-white text-slate-700 border-navy-line hover:bg-navy-soft"
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
          <ChartLegend
            className="mb-2"
            items={[
              { key: "ok", label: "Within limit", color: WORKLOAD.withinLimit },
              { key: "late", label: "Overdue", color: WORKLOAD.overdue },
              { key: "est", label: "Overdue by age only (estimate)", color: WORKLOAD.estimated, hatched: true },
            ]}
          />
          <ul className="divide-y divide-navy-line">
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
                  className={`grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-x-3 py-1.5 ${selected ? "bg-navy-soft -mx-1.5 px-1.5" : ""}`}
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
                  <div style={{ width: `${(row.active / maxActive) * 100}%`, minWidth: row.active > 0 ? 6 : 0 }}>
                    <StackedBar
                      label={who.label}
                      segments={[
                        { key: "ok", label: "within limit", value: onTime, color: WORKLOAD.withinLimit },
                        { key: "late", label: "overdue", value: row.overdue, color: WORKLOAD.overdue },
                        { key: "est", label: "overdue by age only", value: row.overdueEstimated, color: WORKLOAD.estimated, hatched: true },
                      ]}
                    />
                  </div>
                  <span className="text-xs text-slate-700 font-sans tabular-nums text-right whitespace-nowrap">
                    <strong>{row.active}</strong> active
                    {row.overdue > 0 && <span className={`font-semibold ${TEXT_LOSS}`}> · {row.overdue} overdue</span>}
                    <span className="hidden sm:inline text-slate-600"> · {seats}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <DataTableToggle
            caption="Workload by recruiter"
            columns={["Recruiter", "Active", "Overdue", "By age only", "Seats filled", "Seats requested"]}
            rows={shown.map((r) => ({ key: r.recruiterId, cells: [formatRecruiterName(r.name).label, r.active, r.overdue, r.overdueEstimated, r.filledSeats, r.requestedSeats] }))}
          />
          <p className="mt-2 text-xs text-slate-500 font-sans tabular-nums">
            {mode === "load" ? "Most overloaded" : "Most available"} {shown.length} of {rows.length}. The All recruiters tab lists everyone.
          </p>
        </div>
      )}
    </AnalyticsPanel>
  );
};
