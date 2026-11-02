import React from "react";
import type { BackoutSummary } from "../../../lib/types/analytics.types";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { NEUTRAL_MARK, RESPONSIBILITY, TEXT_LOSS } from "../../../lib/chart-palette";
import { AnimatedNumber } from "./motion";
import { BarMark, StackedBar } from "./chart-primitives";

interface BackoutPanelProps {
  data: BackoutSummary;
  rangeLabel?: string;
}

const PARTIES = ["APPLICANT", "CLIENT", "AGENCY"] as const;
const MAX_REASONS = 5;
const PARTY_WORD = { APPLICANT: "Applicant", CLIENT: "Client", AGENCY: "Agency" } as const;

/** One panel: how many people left and when, who pulled out, and the commonest reasons. */
export const BackoutPanel: React.FC<BackoutPanelProps> = ({ data, rangeLabel }) => {
  const total = data.withdrawals + data.backouts;
  const partyTotal = PARTIES.reduce((s, p) => s + data.byParty[p], 0);
  const reasons = data.topReasons.slice(0, MAX_REASONS);
  const maxReason = Math.max(1, ...reasons.map((r) => r.count));

  return (
    <AnalyticsPanel
      id="backouts"
      title="Why people backed out"
      subtitle={`Recorded ${rangeLabel ?? "in this period"}. Client declines are not backouts.`}
    >
      {total === 0 ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">None recorded in this period.</p>
      ) : (
        <div className="p-3.5 space-y-4">
          <div>
            <dl className="grid grid-cols-2 gap-3">
              <div title="Applicants who left before the client reviewed them">
                <dt className="text-xs font-semibold text-slate-600">Before client review</dt>
                <dd className="text-2xl font-bold tabular-nums text-slate-950"><AnimatedNumber value={data.withdrawals} /></dd>
              </div>
              <div title="Candidates who left once the client had reviewed them, up to their start date">
                <dt className="text-xs font-semibold text-slate-600">After client review</dt>
                <dd className={`text-2xl font-bold tabular-nums ${TEXT_LOSS}`}><AnimatedNumber value={data.backouts} /></dd>
              </div>
            </dl>
            {data.noShows > 0 && <p className="mt-1 text-xs text-slate-600 font-sans tabular-nums">of which {data.noShows} no-shows</p>}
          </div>

          {partyTotal > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-1.5">Who backed out</h3>
              <StackedBar
                label="Who backed out"
                heightClass="h-3"
                segments={PARTIES.map((p) => ({ key: p, label: PARTY_WORD[p], value: data.byParty[p], color: RESPONSIBILITY[p] }))}
              />
              <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-sans text-slate-700">
                {PARTIES.map((p) => (
                  <li key={p} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: RESPONSIBILITY[p] }} aria-hidden="true" />
                    {PARTY_WORD[p]}
                    <span className="font-semibold tabular-nums text-slate-900">{data.byParty[p]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reasons.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-2">Top reasons</h3>
              <ul className="space-y-1.5">
                {reasons.map((r) => (
                  <li key={r.reason} className="text-xs">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-sans text-slate-900">{r.label}</span>
                      <span className="tabular-nums text-slate-700">{r.count}</span>
                    </div>
                    <div className="mt-0.5">
                      <BarMark label={r.label} value={r.count} max={maxReason} pct={`${Math.round((r.count / total) * 100)}% of all`} color={NEUTRAL_MARK} heightClass="h-2" focusable />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AnalyticsPanel>
  );
};
