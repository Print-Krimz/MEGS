import React from "react";
import { Link } from "@tanstack/react-router";
import type { BackoutSummary, ClientDecisions } from "../../lib/types/analytics.types";
import { BACKOUT_PARTY_LABELS, BACKOUT_REASON_LABELS } from "../../lib/backout";
import { formatDate } from "../../lib/utils";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { analyticsStageLabel } from "./stage-label";

interface BackoutPanelProps {
  data: BackoutSummary;
  /** Client answers in the same dates: accepted candidates and declined ones. */
  clientDecisions?: ClientDecisions;
  rangeLabel: string;
  /** Latest backouts with links to each application (TA). */
  showRecent?: boolean;
  /** Stacked bars of backouts by stage and responsible party (Admin). */
  showStageBars?: boolean;
  /** Keep the headline numbers and fold the stage, reason, client and request breakdown behind a toggle. */
  compact?: boolean;
}

const PARTY_STYLE = {
  APPLICANT: "bg-slate-500",
  CLIENT: "bg-amber-500",
  AGENCY: "bg-rose-600",
} as const;

export const BackoutPanel: React.FC<BackoutPanelProps> = ({ data, clientDecisions, rangeLabel, showRecent, showStageBars, compact = false }) => {
  const total = data.withdrawals + data.backouts;
  const maxStage = Math.max(1, ...data.byStage.map((s) => s.total));
  const maxReason = Math.max(1, ...data.topReasons.map((r) => r.count));

  return (
    <AnalyticsPanel
      id="backouts"
      title="Withdrawals and backouts"
      subtitle={`Recorded ${rangeLabel}. A candidate the client declined is not counted as a backout.`}
    >
      {clientDecisions && clientDecisions.accepted + clientDecisions.declined > 0 && (
        <p className="border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-700 font-sans tabular-nums">
          Client answers: <strong>{clientDecisions.accepted}</strong> accepted, <strong>{clientDecisions.declined}</strong> declined.
        </p>
      )}
      {total === 0 ? (
        <p className="px-3.5 py-3 text-xs text-slate-500 font-sans">No withdrawals or backouts were recorded in this period.</p>
      ) : (
        <div className="p-3.5 space-y-3">
          <dl className="grid grid-cols-3 gap-3">
            <div title="Applicants who left before the client reviewed them">
              <dt className="text-xs font-semibold text-slate-600">Before client review</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-950">{data.withdrawals}</dd>
            </div>
            <div title="Candidates who left once the client had reviewed them, up to their start date">
              <dt className="text-xs font-semibold text-slate-600">After client review</dt>
              <dd className="text-2xl font-bold tabular-nums text-rose-700">{data.backouts}</dd>
            </div>
            <div title="Recorded as no-show. Counted in the totals by stage, shown here on their own.">
              <dt className="text-xs font-semibold text-slate-600">No-shows</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-950">{data.noShows}</dd>
            </div>
          </dl>

          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-sans text-slate-700" aria-label="Who pulled out">
            {(Object.keys(PARTY_STYLE) as (keyof typeof PARTY_STYLE)[]).map((party) => (
              <li key={party} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 ${PARTY_STYLE[party]}`} aria-hidden="true" />
                {BACKOUT_PARTY_LABELS[party]}
                <span className="font-mono font-semibold tabular-nums">
                  {data.byParty[party]} ({Math.round((data.byParty[party] / total) * 100)}%)
                </span>
              </li>
            ))}
          </ul>

          {compact ? (
            <details className="group">
              <summary className="min-h-11 md:min-h-9 flex items-center text-sm font-semibold text-navy cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                Breakdown by stage, reason, client and request
              </summary>
              <div className="mt-3 space-y-5">
          <div className={showStageBars ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : ""}>
          {showStageBars && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-2">By stage</h3>
              <ul className="space-y-2">
                {data.byStage.map((row) => (
                  <li
                    key={row.stage}
                    aria-label={`${analyticsStageLabel(row.stage, row.label)}: ${row.APPLICANT} applicant, ${row.CLIENT} client, ${row.AGENCY} agency`}
                  >
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-sans text-slate-900">{analyticsStageLabel(row.stage, row.label)}</span>
                      <span className="font-mono tabular-nums text-slate-700">{row.total}</span>
                    </div>
                    <div className="mt-0.5 h-3 bg-slate-100">
                      <div className="flex h-full" style={{ width: `${(row.total / maxStage) * 100}%` }}>
                        {(Object.keys(PARTY_STYLE) as (keyof typeof PARTY_STYLE)[]).map((party) =>
                          row[party] > 0 ? (
                            <div
                              key={party}
                              className={PARTY_STYLE[party]}
                              style={{ width: `${(row[party] / row.total) * 100}%` }}
                              title={`${BACKOUT_PARTY_LABELS[party]}: ${row[party]}`}
                            />
                          ) : null
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Top reasons</h3>
            <ul className="space-y-1.5">
              {data.topReasons.map((r) => (
                <li key={r.reason} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-slate-900">{BACKOUT_REASON_LABELS[r.reason] ?? r.reason}</span>
                    <span className="font-mono tabular-nums text-slate-700">{r.count}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 bg-slate-100">
                    <div className="h-full bg-slate-600" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          </div>

          {(data.byClient.length > 1 || data.byRequest.length > 0) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">By client</h3>
                <ul className="space-y-1 text-xs font-sans text-slate-900">
                  {data.byClient.map((c) => (
                    <li key={c.clientName} className="flex justify-between gap-3">
                      <span className="truncate">{c.clientName}</span>
                      <span className="font-mono tabular-nums text-slate-700">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">By request</h3>
                <ul className="space-y-1 text-xs font-sans text-slate-900">
                  {data.byRequest.map((r) => (
                    <li key={r.mrfId} className="flex justify-between gap-3">
                      <span className="truncate" title={r.clientName ?? undefined}>{r.title}</span>
                      <span className="font-mono tabular-nums text-slate-700">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

              </div>
            </details>
          ) : (
            <>
          <div className={showStageBars ? "grid grid-cols-1 gap-4 sm:grid-cols-2" : ""}>
          {showStageBars && (
            <div>
              <h3 className="text-xs font-semibold text-slate-600 mb-2">By stage</h3>
              <ul className="space-y-2">
                {data.byStage.map((row) => (
                  <li
                    key={row.stage}
                    aria-label={`${analyticsStageLabel(row.stage, row.label)}: ${row.APPLICANT} applicant, ${row.CLIENT} client, ${row.AGENCY} agency`}
                  >
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-sans text-slate-900">{analyticsStageLabel(row.stage, row.label)}</span>
                      <span className="font-mono tabular-nums text-slate-700">{row.total}</span>
                    </div>
                    <div className="mt-0.5 h-3 bg-slate-100">
                      <div className="flex h-full" style={{ width: `${(row.total / maxStage) * 100}%` }}>
                        {(Object.keys(PARTY_STYLE) as (keyof typeof PARTY_STYLE)[]).map((party) =>
                          row[party] > 0 ? (
                            <div
                              key={party}
                              className={PARTY_STYLE[party]}
                              style={{ width: `${(row[party] / row.total) * 100}%` }}
                              title={`${BACKOUT_PARTY_LABELS[party]}: ${row[party]}`}
                            />
                          ) : null
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-2">Top reasons</h3>
            <ul className="space-y-1.5">
              {data.topReasons.map((r) => (
                <li key={r.reason} className="text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-sans text-slate-900">{BACKOUT_REASON_LABELS[r.reason] ?? r.reason}</span>
                    <span className="font-mono tabular-nums text-slate-700">{r.count}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 bg-slate-100">
                    <div className="h-full bg-slate-600" style={{ width: `${(r.count / maxReason) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          </div>

          {(data.byClient.length > 1 || data.byRequest.length > 0) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">By client</h3>
                <ul className="space-y-1 text-xs font-sans text-slate-900">
                  {data.byClient.map((c) => (
                    <li key={c.clientName} className="flex justify-between gap-3">
                      <span className="truncate">{c.clientName}</span>
                      <span className="font-mono tabular-nums text-slate-700">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-slate-600 mb-2">By request</h3>
                <ul className="space-y-1 text-xs font-sans text-slate-900">
                  {data.byRequest.map((r) => (
                    <li key={r.mrfId} className="flex justify-between gap-3">
                      <span className="truncate" title={r.clientName ?? undefined}>{r.title}</span>
                      <span className="font-mono tabular-nums text-slate-700">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

            </>
          )}

          {showRecent && data.recent.length > 0 && (
            <div className="overflow-x-auto">
              <h3 className="text-xs font-semibold text-slate-600 mb-2">Latest</h3>
              <table className={`w-full text-xs ${compact ? "" : "min-w-[34rem]"}`}>
                <thead>
                  <tr className="text-left text-xs text-slate-600 border-b border-slate-200">
                    <th scope="col" className="py-1.5 pr-3 font-bold">Candidate</th>
                    {!compact && <th scope="col" className="py-1.5 pr-3 font-bold">Stage</th>}
                    {!compact && <th scope="col" className="py-1.5 pr-3 font-bold">Who</th>}
                    <th scope="col" className="py-1.5 pr-3 font-bold">Reason</th>
                    <th scope="col" className="py-1.5 font-bold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent.map((b) => (
                    <tr key={b.applicationId}>
                      <td className="py-1.5 pr-3">
                        <Link
                          to="/ta/applications/$applicationId"
                          params={{ applicationId: String(b.applicationId) }}
                          className="font-semibold text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {b.candidateName}
                        </Link>
                        <span className="block text-xs text-slate-500">
                          {b.jobTitle}
                          {b.clientName ? ` · ${b.clientName}` : ""}
                        </span>
                        {b.mrfId !== null && (
                          <Link
                            to="/ta/mrfs/$mrfId"
                            params={{ mrfId: String(b.mrfId) }}
                            className="text-xs text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                          >
                            View request
                          </Link>
                        )}
                      </td>
                      {!compact && <td className="py-1.5 pr-3 text-slate-700">{analyticsStageLabel(b.stage, b.stage.replace(/_/g, " ").toLowerCase())}</td>}
                      {!compact && <td className="py-1.5 pr-3 text-slate-700">{BACKOUT_PARTY_LABELS[b.party]}</td>}
                      <td className="py-1.5 pr-3 text-slate-700">
                        {BACKOUT_REASON_LABELS[b.reason] ?? b.reason}
                        {compact && (
                          <span className="block text-xs text-slate-600">
                            {analyticsStageLabel(b.stage, b.stage.replace(/_/g, " ").toLowerCase())} · {BACKOUT_PARTY_LABELS[b.party]}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 whitespace-nowrap text-slate-700">{formatDate(b.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AnalyticsPanel>
  );
};
