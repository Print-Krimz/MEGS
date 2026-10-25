import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { StageTableRow } from "../../lib/types/analytics.types";
import type { ApplicationStatus } from "../../lib/types/enums";
import { AlertTriangle, Eye } from "lucide-react";
import { HEALTH_CHIP, TEXT_LOSS, TEXT_AMBER, hatchStyle, stageColor } from "../../lib/chart-palette";
import { analyticsStageLabel } from "./stage-label";
import { BarMark, DataTableToggle } from "./chart-primitives";
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

/** Stage names come from the shared TA glossary so Reports and Overview read the same. */
const stageLabel = (row: StageTableRow) => analyticsStageLabel(row.stage, row.label);

const limitText = (row: StageTableRow) =>
  row.stage === "DEPLOYED" ? "scheduled start, no limit" : row.stage === "CLIENT_ENDORSEMENT" ? "limit set per client" : `limit ${row.slaDays} days`;

/**
 * The pipeline from application to start as one row of cards. In stage, overdue and typical wait (median days) are always on the card.
 * Stages where many people are past the limit are tinted, so the bottleneck is visible without reading a table.
 * Entered, backed out and the by-age-only note are one toggle away.
 */
export const StagePipeline: React.FC<StagePipelineProps> = ({ rows, rangeLabel, onSelectStage, linkStages = false }) => {
  const [details, setDetails] = useState(false);
  const empty = rows.every((r) => r.inStageNow === 0 && r.entered === 0 && r.backedOut === 0);
  const maxEntered = Math.max(1, ...rows.map((r) => r.entered));
  const hasEstimates = rows.some((r) => r.overdueEstimated > 0);

  return (
    <AnalyticsPanel
      id="stage-pipeline"
      title="Candidates by stage"
      subtitle={`In order from application to start. The big number is how many candidates entered the stage during ${rangeLabel}. "In stage now" is how many are there today, and "typical wait" is how long they have been waiting.${
        hasEstimates ? ' "By age only" counts candidates past the limit with no recorded stage change. Their days run from the application date, so the real wait may be shorter.' : ""
      }`}
      aside={
        <button
          type="button"
          aria-pressed={details}
          onClick={() => setDetails((d) => !d)}
          className="min-h-11 md:min-h-8 px-2 text-xs font-semibold border border-navy-line bg-white text-slate-700 hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {details ? "Hide period details" : "Show period details"}
        </button>
      }
    >
      {empty ? (
        <p className="p-4 text-center text-xs text-slate-500 font-sans">No candidates are in the pipeline and none moved in this period.</p>
      ) : (
        <div className="p-3">
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {rows.map((row) => {
              const pressure = pressureOf(row);
              const late = row.overdue + row.overdueEstimated;
              const color = stageColor(row.stage);
              const tooltip = `${stageLabel(row)}: ${row.inStageNow} in stage, ${row.overdue} overdue${row.overdueEstimated > 0 ? ` and ${row.overdueEstimated} more by age only` : ""}. ${row.entered} entered and ${row.backedOut} backed out in ${rangeLabel}. ${limitText(row)}.`;
              const content = (
                <>
                  <span className="block text-xs font-semibold font-sans text-slate-900 leading-tight">{stageLabel(row)}</span>
                  <span className="mt-1.5 block text-2xl font-bold tabular-nums text-slate-950">
                    {row.entered}
                    <span className="ml-1 text-[11px] font-sans font-normal text-slate-600">entered</span>
                  </span>
                  <span className="mt-1 block">
                    <BarMark label={`${stageLabel(row)} entered`} value={row.entered} max={maxEntered} color={color} pct={`during ${rangeLabel}`} heightClass="h-2.5" />
                  </span>
                  <span className="mt-1.5 block text-xs tabular-nums text-slate-700">{row.inStageNow} in stage now</span>
                  <span className={`block text-xs tabular-nums ${late > 0 && row.stage !== "DEPLOYED" ? `font-semibold ${TEXT_LOSS}` : "text-slate-500"}`}>
                    {row.stage === "DEPLOYED" ? "No limit" : `${row.overdue} overdue`}
                    {row.overdueEstimated > 0 && (
                      <span className={`font-normal ${TEXT_AMBER}`}>
                        {" "}
                        <span className="mr-0.5 inline-block h-2 w-2 align-baseline" style={hatchStyle("#9A5B00")} aria-hidden="true" />+{row.overdueEstimated} by age only
                      </span>
                    )}
                  </span>
                  <span className="block text-xs tabular-nums text-slate-600">{row.medianDaysInStage === null ? "No one waiting" : `Typical wait: ${row.medianDaysInStage} ${row.medianDaysInStage === 1 ? "day" : "days"}`}</span>
                  {pressure !== "none" && (
                    <span className={`mt-1.5 inline-flex items-center gap-1 border px-1.5 py-px text-xs font-semibold ${HEALTH_CHIP[pressure].className}`}>
                      {pressure === "bottleneck" ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <Eye className="h-3 w-3" aria-hidden="true" />}
                      {HEALTH_CHIP[pressure].label}
                    </span>
                  )}
                  {details && (
                    <span className="mt-1.5 block border-t border-navy-line pt-1.5 text-[11px] font-sans text-slate-700 tabular-nums">
                      <span className={`block ${row.backedOut > 0 ? TEXT_LOSS : ""}`}>{row.backedOut} backed out</span>
                      <span className="block text-slate-500">{limitText(row)}</span>
                    </span>
                  )}
                </>
              );
              const frame = "block h-full w-full rounded-md border border-navy-line bg-white p-2.5 text-left";
              const topRule = { borderTop: `3px solid ${color}` };
              return (
                <li key={row.stage} aria-label={tooltip} title={tooltip} className="min-w-0">
                  {linkStages && row.stage !== "APPLIED" && row.stage !== "DEPLOYED" ? (
                    <Link
                      to="/ta/applications"
                      search={{ stage: row.stage as ApplicationStatus }}
                      style={topRule}
                      className={`${frame} hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
                    >
                      {content}
                    </Link>
                  ) : onSelectStage && row.stage !== "DEPLOYED" && late > 0 ? (
                    <button
                      type="button"
                      onClick={() => onSelectStage(row.stage)}
                      style={topRule}
                      className={`${frame} hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div style={topRule} className={frame}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <DataTableToggle
            caption={`Candidates by stage, with entered and backed out in ${rangeLabel}`}
            columns={["Stage", "Entered in period", "In stage now", "Overdue", "By age only", "Backed out"]}
            rows={rows.map((r) => ({ key: r.stage, cells: [stageLabel(r), r.entered, r.inStageNow, r.overdue, r.overdueEstimated, r.backedOut] }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
