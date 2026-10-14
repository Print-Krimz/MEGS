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
  /** Stages bypassed by an authorised skip (never shown as Completed/Passed). */
  skippedStages?: { stage: string; reason?: string | null; actorEmail?: string | null; at?: string | null }[];
}

const CANONICAL_STAGES = [
  { id: ApplicationStatus.SUBMITTED, label: TA_COPY.pipeline.submitted },
  { id: ApplicationStatus.INITIAL_SCREENING, label: "Initial review" },
  { id: ApplicationStatus.CLIENT_ENDORSEMENT, label: "Client review" },
  { id: ApplicationStatus.FINAL_INTERVIEW, label: "Final interview" },
  { id: ApplicationStatus.COMPLIANCE, label: TA_COPY.pipeline.requirements },
  { id: ApplicationStatus.CONTRACT_SIGNING, label: TA_COPY.pipeline.contractSigning },
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
  skippedStages = [],
}) => {
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  const activeIndex = getPipelineStageIndex(currentStatus);

  return (
    <div className={cn("w-full py-2 space-y-2", className)}>
      {/* Visual Checkpoints Stepper (Fluid and 100% visible on all screen sizes) */}
      <div className="w-full pt-1">
        <div className="flex items-start w-full">
          {CANONICAL_STAGES.map((stage, idx) => {
            const skipped = skippedStages.find((entry) => entry.stage === stage.id);
            const isSkipped = Boolean(skipped) && activeIndex > idx;
            const isCompleted = activeIndex > idx && !isSkipped;
            const isFinalDeployed = stage.id === ApplicationStatus.DEPLOYED && activeIndex === idx;
            const isCurrent = activeIndex === idx && !isTerminal && !isFinalDeployed;

            const circleClass = isSkipped
              ? "bg-amber-50 border-amber-400 text-amber-700"
              : isCompleted || isFinalDeployed
              ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
              : isCurrent
              ? "bg-white border-2 border-slate-900 text-slate-900 ring-2 sm:ring-4 ring-slate-100 font-bold"
              : "bg-white border border-slate-200 text-slate-500";

            const labelClass = isSkipped
              ? "text-amber-700 font-semibold"
              : isCurrent
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
                      "absolute top-3 sm:top-3.5 -translate-y-1/2 left-1/2 w-full h-0.5 transition-colors duration-300",
                      activeIndex > idx || (isFinalDeployed && idx < CANONICAL_STAGES.length - 1)
                        ? "bg-emerald-600"
                        : "bg-slate-200"
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Step Node */}
                <div
                  className={cn(
                    "relative z-10 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-semibold border transition-all shrink-0",
                    circleClass
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                  title={
                    isSkipped
                      ? `Skipped${skipped?.reason ? `: ${skipped.reason}` : ""}${skipped?.actorEmail ? ` - ${skipped.actorEmail}` : ""}${skipped?.at ? ` (${new Date(skipped.at).toLocaleString()})` : ""}`
                      : undefined
                  }
                >
                  {isSkipped ? (
                    <span aria-hidden="true">-</span>
                  ) : isCompleted || isFinalDeployed ? (
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Label in normal document flow below the node */}
                <div className="mt-1.5 sm:mt-2 text-center w-full px-0.5">
                  <span className={cn("text-[9px] leading-[1.1] sm:text-xs sm:leading-tight block font-medium break-words hyphens-auto", labelClass)}>
                    {stage.label}
                  </span>
                  {isSkipped && <span className="block text-[9px] sm:text-[10px] uppercase tracking-wide text-amber-700">Skipped</span>}
                </div>
              </div>
            );
          })}
        </div>
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
