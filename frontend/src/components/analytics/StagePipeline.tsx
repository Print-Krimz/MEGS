import React, { useId } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { StageTableRow } from "../../lib/types/analytics.types";
import type { ApplicationStatus } from "../../lib/types/enums";
import { BAR_ON_TRACK, TEXT_LOSS, WORKLOAD } from "../../lib/chart-palette";
import { formatSampled } from "../../lib/analytics-format";
import { DataTableToggle, StackedBar } from "./chart-primitives";
import { AnalyticsPanel } from "./AnalyticsPanel";

interface StagePipelineProps {
  rows: StageTableRow[];
  /** Called when a stage row is chosen, e.g. to list the overdue candidates in that stage. */
  onSelectStage?: (stage: string) => void;
  /** A TA's rows link to their applications list filtered to that stage. */
  linkStages?: boolean;
  /** Shown under the rows, e.g. the Client answers line. */
  footer?: React.ReactNode;
  /** E.g. "h-full" so the panel matches the height of the panels beside it. */
  className?: string;
}

/** Overdue candidates are part of the stage total, never added on top; Deployed has no limit so it is never overdue. */
const overdueIn = (row: StageTableRow) =>
  row.stage === "DEPLOYED" ? 0 : Math.min(row.inStageNow, Math.max(0, row.overdue + row.overdueEstimated));

const overduePct = (late: number, total: number) => `${Math.round((late / total) * 100)}%`;

const overdueText = (row: StageTableRow) =>
  row.overdueEstimated > 0 ? `${row.overdue} + ${row.overdueEstimated} estimated` : String(row.overdue);

const waitText = (row: StageTableRow) =>
  row.inStageNow === 0 ? "No one in this stage" : formatSampled(row.medianDaysInStage, row.typicalWaitSample, "days");

const limitText = (row: StageTableRow) =>
  row.stage === "DEPLOYED" ? "None" : row.stage === "CLIENT_ENDORSEMENT" ? "Set per client" : `${row.slaDays} days`;

/** "avg 2.5 days vs 3-day limit". Hidden when the average is too thin to show or the stage has no limit. */
const avgText = (row: StageTableRow) => {
  if (row.stage === "DEPLOYED" || row.avgDaysInStage === null) return null;
  const limit = row.stage === "CLIENT_ENDORSEMENT" ? "client limit" : `${row.slaDays}-day limit`;
  return { text: `avg ${row.avgDaysInStage} ${row.avgDaysInStage === 1 ? "day" : "days"} vs ${limit}`, over: row.stage !== "CLIENT_ENDORSEMENT" && row.avgDaysInStage > row.slaDays };
};

// Phones: name and count on one line, the bar full width under them. Wider screens: three aligned columns.
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 @xl:grid-cols-[9rem_minmax(0,1fr)_14rem] @xl:gap-y-0";
const BAR_CELL = "col-span-2 row-start-2 @xl:col-span-1 @xl:col-start-2 @xl:row-start-1";

/**
 * The pipeline from application to start as one bar per stage. The full bar is how many candidates are in the stage
 * now (every bar on the same scale); the part past the limit is red, the rest is the on-track blue. Exact values are
 * under View as table.
 */
export const StagePipeline: React.FC<StagePipelineProps> = ({ rows, onSelectStage, linkStages = false, footer, className }) => {
  const empty = rows.every((r) => r.inStageNow === 0 && r.entered === 0 && r.backedOut === 0);
  const maxInStage = Math.max(1, ...rows.map((r) => r.inStageNow));
  const baseId = useId();

  return (
    <AnalyticsPanel tone="reports" id="stage-pipeline" title="Candidates by stage" className={className}>
      {empty ? (
        <p className="p-4 text-center text-xs text-slate-600 font-sans">No candidates in the pipeline and none moved in these dates.</p>
      ) : (
        <div className="@container p-3.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs font-sans text-slate-600">
            <p>How many candidates are in each stage right now. Red is the part past the stage&apos;s days allowed.</p>
            <div className="flex items-center gap-3" data-testid="stage-legend">
              {[
                ["On track", BAR_ON_TRACK],
                ["Overdue", WORKLOAD.overdue],
              ].map(([name, color]) => (
                <span key={name} className="flex items-center gap-1">
                  <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
          <ol>
            {rows.map((row, i) => {
              const late = overdueIn(row);
              const name = row.label;
              const share = late > 0 ? `${late} overdue (${overduePct(late, row.inStageNow)})` : "";
              const avg = avgText(row);
              const avgId = `${baseId}-${row.stage}`;
              const describedBy = avg ? avgId : undefined;
              const summary = `${name}, ${row.inStageNow}${share ? ` · ${share}` : ""}`;
              const link = linkStages && row.stage !== "APPLIED" && row.stage !== "DEPLOYED";
              const pick = !link && !!onSelectStage && late > 0;
              const label = link || pick ? `${summary}. Show these candidates` : summary;
              const content = (
                <>
                  <span className="col-start-1 row-start-1 truncate text-left text-xs font-semibold font-sans text-slate-900">{name}</span>
                  <StackedBar
                    className={BAR_CELL}
                    label={name}
                    index={i}
                    heightClass="h-3"
                    max={maxInStage}
                    segments={[
                      { key: "ok", label: "on track", value: Math.max(0, row.inStageNow - late), color: BAR_ON_TRACK },
                      { key: "late", label: "overdue", value: late, color: WORKLOAD.overdue },
                    ]}
                  />
                  <span className="col-start-2 row-start-1 whitespace-nowrap text-right text-xs font-sans tabular-nums text-slate-700 @xl:col-start-3">
                    <strong className="text-slate-950">{row.inStageNow}</strong>
                    {late > 0 && <span className={`font-semibold ${TEXT_LOSS}`}> · {share}</span>}
                    {pick && (
                      <span aria-hidden="true" className="ml-1 inline-flex items-center text-xs font-semibold text-navy">
                        <span className="hidden @xl:inline">Show</span>
                        <ChevronRight size={14} className="shrink-0" />
                      </span>
                    )}
                    {avg && <span id={avgId} className={`block text-xs ${avg.over ? `font-semibold ${TEXT_LOSS}` : "text-slate-600"}`}>{avg.text}{avg.over && <span className="sr-only"> (over the limit)</span>}</span>}
                  </span>
                </>
              );
              const frame = `${ROW_GRID} w-full px-1.5 py-1.5 text-left`;
              const hover = "hover:bg-navy-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";
              return (
                <li key={row.stage} className="min-w-0 border-b border-navy-line last:border-b-0">
                  {link ? (
                    <Link to="/ta/applications" search={{ stage: row.stage as ApplicationStatus }} aria-label={label} aria-describedby={describedBy} className={`${frame} ${hover}`}>
                      {content}
                    </Link>
                  ) : pick ? (
                    <button type="button" aria-label={label} aria-describedby={describedBy} onClick={() => onSelectStage?.(row.stage)} className={`${frame} ${hover} cursor-pointer`}>
                      {content}
                    </button>
                  ) : (
                    <div role="group" aria-label={label} aria-describedby={describedBy} className={frame}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-start justify-between gap-x-4">
          <DataTableToggle
            className="min-w-[10rem] flex-1"
            caption="Exact counts and waits for each stage"
            columns={["Stage", "Entered", "In stage", "Overdue", "Typical wait", "Days allowed", "Backed out"]}
            rows={rows.map((r) => ({
              key: r.stage,
              cells: [
                r.label,
                r.entered,
                r.inStageNow,
                overdueText(r),
                waitText(r),
                limitText(r),
                r.backedOut,
              ],
            }))}
          />
          {footer && <div className="mt-3 flex min-h-11 items-center text-xs font-sans text-slate-700 md:min-h-8">{footer}</div>}
          </div>
        </div>
      )}
      {footer && empty && <div className="border-t border-navy-line px-3.5 py-2.5 text-xs font-sans text-slate-700">{footer}</div>}
    </AnalyticsPanel>
  );
};
