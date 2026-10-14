import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StageTableRow } from "../../lib/types/analytics.types";
import type { ApplicationStatus } from "../../lib/types/enums";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface StagePipelineProps {
  rows: StageTableRow[];
  rangeLabel: string;
  /** Called when a stage card is chosen, e.g. to list the overdue candidates in that stage. */
  onSelectStage?: (stage: string) => void;
  /** A TA's cards link to their applications list filtered to that stage. */
  linkStages?: boolean;
}

type Pressure = "none" | "watch" | "bottleneck";

/** A stage is a bottleneck when a large share of the people in it are past the limit. */
const pressureOf = (row: StageTableRow): Pressure => {
  if (row.stage === "DEPLOYED" || row.inStageNow === 0) return "none";
  const late = row.overdue + row.overdueEstimated;
  if (late === 0) return "none";
  const share = late / row.inStageNow;
  if (share >= 0.4 && late >= 2) return "bottleneck";
  return share >= 0.15 ? "watch" : "none";
};

const CARD: Record<Pressure, string> = {
  none: "border-slate-300 bg-white",
  watch: "border-amber-400 bg-amber-50",
  bottleneck: "border-rose-400 bg-rose-50",
};

const limitText = (row: StageTableRow) =>
  row.stage === "DEPLOYED" ? "scheduled start, no limit" : row.stage === "CLIENT_ENDORSEMENT" ? "limit set per client" : `limit ${row.slaDays} days`;

/**
 * The pipeline from application to start as one row of cards. In stage, overdue and median days are always on the card.
 * Stages where many people are past the limit are tinted, so the bottleneck is visible without reading a table.
 * Entered, backed out and the by-age-only note are one toggle away.
 */
export const StagePipeline: React.FC<StagePipelineProps> = ({ rows, rangeLabel, onSelectStage, linkStages = false }) => {
  const [details, setDetails] = useState(false);
  const empty = rows.every((r) => r.inStageNow === 0 && r.entered === 0 && r.backedOut === 0);
  const hasEstimates = rows.some((r) => r.overdueEstimated > 0);

  return (
    <AnalyticsPanel
      id="stage-pipeline"
      title="Where candidates are"
      subtitle={`Current counts by stage, in order from application to start. A tinted stage has many candidates past its limit. Entered and backed out cover ${rangeLabel}.${
        hasEstimates ? ' "By age only" counts candidates past the limit with no recorded stage change. Their days run from the application date, so the real wait may be shorter.' : ""
      }`}
      aside={
        <button
          type="button"
          aria-pressed={details}
          onClick={() => setDetails((d) => !d)}
          className="min-h-8 px-2 text-[11px] font-sans font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D]"
        >
          {details ? "Hide period details" : "Show period details"}
        </button>
      }
    >
      {empty ? (
        <p className="p-4 text-center text-xs text-slate-500 font-sans">No candidates are in the pipeline and none moved in this period.</p>
      ) : (
        <ol className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 xl:grid-cols-7">
          {rows.map((row, index) => {
            const pressure = pressureOf(row);
            const late = row.overdue + row.overdueEstimated;
            const tooltip = `${row.label}: ${row.inStageNow} in stage, ${row.overdue} overdue${row.overdueEstimated > 0 ? ` and ${row.overdueEstimated} more by age only` : ""}. ${row.entered} entered and ${row.backedOut} backed out in ${rangeLabel}. ${limitText(row)}.`;
            const content = (
              <>
                <span className="flex items-start justify-between gap-1">
                  <span className="text-xs font-semibold font-sans text-slate-900 leading-tight">{row.label}</span>
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums" aria-hidden="true">
                    {index + 1}
                  </span>
                </span>
                <span className="mt-1.5 block text-2xl font-bold tabular-nums text-slate-950">
                  {row.inStageNow}
                  <span className="ml-1 text-[11px] font-sans font-normal text-slate-600">in stage</span>
                </span>
                <span className={`mt-0.5 block text-xs tabular-nums ${late > 0 && row.stage !== "DEPLOYED" ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                  {row.stage === "DEPLOYED" ? "No limit" : `${row.overdue} overdue`}
                  {row.overdueEstimated > 0 && <span className="font-normal text-amber-800"> +{row.overdueEstimated} by age only</span>}
                </span>
                <span className="block text-xs tabular-nums text-slate-600">{row.medianDaysInStage === null ? "No median yet" : `Median ${row.medianDaysInStage} days`}</span>
                {pressure !== "none" && (
                  <span className={`mt-1.5 inline-block border px-1.5 py-px text-[11px] font-mono font-bold uppercase ${pressure === "bottleneck" ? "border-rose-400 text-rose-800" : "border-amber-400 text-amber-900"}`}>
                    {pressure === "bottleneck" ? "Bottleneck" : "Watch"}
                  </span>
                )}
                {details && (
                  <span className="mt-1.5 block border-t border-slate-300/70 pt-1.5 text-[11px] font-sans text-slate-700 tabular-nums">
                    <span className="block">{row.entered} entered</span>
                    <span className={`block ${row.backedOut > 0 ? "text-rose-700" : ""}`}>{row.backedOut} backed out</span>
                    <span className="block text-slate-500">{limitText(row)}</span>
                  </span>
                )}
              </>
            );
            return (
              <li key={row.stage} aria-label={tooltip} title={tooltip} className="min-w-0 last:col-span-2 xl:last:col-span-1">
                {linkStages && row.stage !== "APPLIED" && row.stage !== "DEPLOYED" ? (
                  <Link
                    to="/ta/applications"
                    search={{ stage: row.stage as ApplicationStatus }}
                    className={`block h-full w-full border p-2.5 text-left hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${CARD[pressure]}`}
                  >
                    {content}
                  </Link>
                ) : onSelectStage && row.stage !== "DEPLOYED" && late > 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectStage(row.stage)}
                    className={`flex h-full w-full flex-col items-stretch justify-start border p-2.5 text-left hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] ${CARD[pressure]}`}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={`h-full border p-2.5 ${CARD[pressure]}`}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </AnalyticsPanel>
  );
};
