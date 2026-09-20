import React from "react";
import { Check, AlertCircle } from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";
import { ApplicationStatusAudience, cn, getApplicationStatusPresentation } from "../../lib/utils";
import { getPipelineStageIndex } from "../../lib/pipeline-stages";
import { TA_COPY } from "../../lib/ta-copy";

export interface PipelineIndicatorProps {
  currentStatus: string;
  audience?: ApplicationStatusAudience;
  className?: string;
  hideTerminalAlert?: boolean;
}

const CANONICAL_STAGES = [
  { id: ApplicationStatus.SUBMITTED, label: TA_COPY.pipeline.submitted },
  { id: ApplicationStatus.INITIAL_SCREENING, label: "Initial review" },
  { id: ApplicationStatus.CLIENT_ENDORSEMENT, label: "Client review" },
  { id: ApplicationStatus.FINAL_INTERVIEW, label: "Final interview" },
  { id: ApplicationStatus.COMPLIANCE, label: TA_COPY.pipeline.requirements },
  { id: ApplicationStatus.CONTRACT_AND_ORIENTATION, label: TA_COPY.pipeline.contractAndOrientation },
  { id: ApplicationStatus.DEPLOYED, label: TA_COPY.pipeline.deployed },
];

const TERMINAL_STATUSES: string[] = [
  ApplicationStatus.TALENT_POOL,
  ApplicationStatus.BACKOUT,
  ApplicationStatus.ARCHIVED,
];

export const PipelineIndicator: React.FC<PipelineIndicatorProps> = ({
  currentStatus,
  audience = "staff",
  className,
  hideTerminalAlert = false,
}) => {
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  const activeIndex = getPipelineStageIndex(currentStatus);
  const currentStageLabel =
    activeIndex >= 0 && activeIndex < CANONICAL_STAGES.length
      ? CANONICAL_STAGES[activeIndex].label
      : currentStatus;

  return (
    <div className={cn("w-full py-2 space-y-2", className)}>
      {/* Mobile Stage Summary pill */}
      <div className="md:hidden flex items-center justify-between gap-3 text-sm bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-lg">
        <span className="text-slate-500 font-medium text-xs">Progress</span>
        <span className="font-semibold text-slate-900 text-xs text-right">
          {activeIndex >= 0 ? `${activeIndex + 1} of ${CANONICAL_STAGES.length}: ${currentStageLabel}` : getApplicationStatusPresentation(currentStatus, audience).label}
        </span>
      </div>

      {/* Desktop Responsive Stepper */}
      <div className="hidden md:flex items-start w-full pt-1">
        {CANONICAL_STAGES.map((stage, idx) => {
          const isCompleted = activeIndex > idx;
          const isFinalDeployed = stage.id === ApplicationStatus.DEPLOYED && activeIndex === idx;
          const isCurrent = activeIndex === idx && !isTerminal && !isFinalDeployed;

          const circleClass = isCompleted || isFinalDeployed
            ? "bg-emerald-600 border-emerald-600 text-white"
            : isCurrent
            ? "bg-white border-2 border-slate-900 text-slate-900 ring-4 ring-slate-100 font-bold"
            : "bg-white border border-slate-200 text-slate-500";

          const labelClass = isCurrent
            ? "text-slate-900 font-bold"
            : isCompleted || isFinalDeployed
            ? "text-emerald-700 font-semibold"
            : "text-slate-500";

          return (
            <div key={stage.id} className="relative flex-1 flex flex-col items-center group min-w-0">
              {/* Connector line to next step */}
              {idx < CANONICAL_STAGES.length - 1 && (
                <div
                  className={cn(
                    "absolute top-3.5 -translate-y-1/2 left-1/2 w-full h-0.5 transition-colors duration-300",
                    activeIndex > idx ? "bg-slate-900" : "bg-slate-200"
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step Node */}
              <div
                className={cn(
                  "relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all shrink-0",
                  circleClass
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isCompleted || isFinalDeployed ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Label in normal document flow below the node */}
              <div className="mt-2 text-center w-full px-1">
                <span className={cn("text-xs leading-tight block", labelClass)}>
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Status Alert banner if in non-linear state */}
      {isTerminal && !hideTerminalAlert && (
        <div className="mt-2 px-3.5 py-2 bg-amber-50 border border-amber-200 flex items-center gap-2 text-sm text-amber-800 rounded-md">
          <AlertCircle className="w-4 h-4 text-amber-800 shrink-0" />
          <span>
            Current status: <strong>{getApplicationStatusPresentation(currentStatus, audience).label}</strong>
          </span>
        </div>
      )}
    </div>
  );
};
