import React from "react";
import { Link } from "@tanstack/react-router";
import type { StageTableRow } from "../../lib/types/analytics.types";
import type { ApplicationStatus } from "../../lib/types/enums";
import { TEXT_LOSS, WORKLOAD, stageColor } from "../../lib/chart-palette";
import { analyticsStageLabel } from "./stage-label";
import { DataTableToggle, StackedBar } from "./chart-primitives";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface StagePipelineProps {
  rows: StageTableRow[];
  rangeLabel: string;
  /** Called when a stage row is chosen, e.g. to list the overdue candidates in that stage. */
  onSelectStage?: (stage: string) => void;
  /** A TA's rows link to their applications list filtered to that stage. */
  linkStages?: boolean;
}

/** Stage names come from the shared TA glossary so Reports and Overview read the same. */
const stageLabel = (row: StageTableRow) => analyticsStageLabel(row.stage, row.label);

const limitText = (row: StageTableRow) =>
  row.stage === "DEPLOYED" ? "None" : row.stage === "CLIENT_ENDORSEMENT" ? "Set per client" : `${row.slaDays} days`;

const ROW_GRID = "grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]";

/**
 * The pipeline from application to start as one bar per stage. The bar is how many candidates are in the stage now;
 * the part past the limit sits at the end in the overdue colour. Entered, typical wait and limit are under Details.
 */
export const StagePipeline: React.FC<StagePipelineProps> = ({ rows, rangeLabel, onSelectStage, linkStages = false }) => {
  const empty = rows.every((r) => r.inStageNow === 0 && r.entered === 0 && r.backedOut === 0);
  const maxInStage = Math.max(1, ...rows.map((r) => r.inStageNow));

  return (
    <AnalyticsPanel id="stage-pipeline" title="Candidates by stage" subtitle="In stage now, from application to start." aside={<span>{rangeLabel}</span>}>
      {empty ? (
        <p className="p-4 text-center text-xs text-slate-500 font-sans">No candidates are in the pipeline and none moved in this period.</p>
      ) : (
        <div className="p-3.5">
          <ol>
            {rows.map((row, i) => {
              const late = row.stage === "DEPLOYED" ? 0 : row.overdue + row.overdueEstimated;
              const name = stageLabel(row);
              const summary = `${name}: ${row.inStageNow} in stage${late > 0 ? `, ${late} overdue` : ""}`;
              const link = linkStages && row.stage !== "APPLIED" && row.stage !== "DEPLOYED";
              const pick = !link && !!onSelectStage && late > 0;
              const label = link || pick ? `${summary}. Show these candidates` : summary;
              const content = (
                <>
                  <span className="truncate text-left text-xs font-semibold font-sans text-slate-900">{name}</span>
                  <StackedBar
                    label={name}
                    index={i}
                    heightClass="h-3"
                    max={maxInStage}
                    segments={[
                      { key: "ok", label: "within limit", value: row.inStageNow - late, color: stageColor(row.stage) },
                      { key: "late", label: "overdue", value: late, color: WORKLOAD.overdue },
                    ]}
                  />
                  <span className="whitespace-nowrap text-right text-xs font-sans tabular-nums text-slate-700">
                    <strong className="text-slate-950">{row.inStageNow}</strong>
                    {late > 0 && <span className={`font-semibold ${TEXT_LOSS}`}> · {late} overdue</span>}
                  </span>
                </>
              );
              const frame = `${ROW_GRID} w-full px-1.5 py-1.5 text-left`;
              const hover = "hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
              return (
                <li key={row.stage} className="min-w-0 border-b border-navy-line last:border-b-0">
                  {link ? (
                    <Link to="/ta/applications" search={{ stage: row.stage as ApplicationStatus }} aria-label={label} className={`${frame} ${hover}`}>
                      {content}
                    </Link>
                  ) : pick ? (
                    <button type="button" aria-label={label} onClick={() => onSelectStage?.(row.stage)} className={`${frame} ${hover}`}>
                      {content}
                    </button>
                  ) : (
                    <div role="group" aria-label={label} className={frame}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <DataTableToggle
            summary="Details"
            caption={`Candidates by stage in ${rangeLabel}`}
            columns={["Stage", "Entered", "In stage", "Overdue", "Overdue by age", "Typical wait", "Limit", "Backed out"]}
            rows={rows.map((r) => ({
              key: r.stage,
              cells: [
                stageLabel(r),
                r.entered,
                r.inStageNow,
                r.overdue,
                r.overdueEstimated,
                r.medianDaysInStage === null ? "None" : `${r.medianDaysInStage} ${r.medianDaysInStage === 1 ? "day" : "days"}`,
                limitText(r),
                r.backedOut,
              ],
            }))}
          />
        </div>
      )}
    </AnalyticsPanel>
  );
};
