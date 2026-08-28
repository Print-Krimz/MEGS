import React from "react";
import { Check, AlertCircle } from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";
import { ApplicationStatusAudience, cn, getApplicationStatusPresentation } from "../../lib/utils";


export interface PipelineIndicatorProps {
  currentStatus: string;
  audience?: ApplicationStatusAudience;
  className?: string;
}

const CANONICAL_STAGES = [
  { id: ApplicationStatus.SUBMITTED, label: "Submitted" },
  { id: ApplicationStatus.INITIAL_SCREENING, label: "Initial review" },
  { id: ApplicationStatus.CLIENT_ENDORSEMENT, label: "Client review" },
  { id: ApplicationStatus.FINAL_INTERVIEW, label: "Final interview" },
  { id: ApplicationStatus.COMPLIANCE, label: "Employment documents (201)" },
  { id: ApplicationStatus.DEPLOYED, label: "Work placement" },
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
}) => {
  const isTerminal = TERMINAL_STATUSES.includes(currentStatus);

  // Map non-canonical intermediate states to canonical stage indices
  const getActiveIndex = (status: string) => {
    switch (status) {
      case ApplicationStatus.SUBMITTED:
      case ApplicationStatus.PARSING:
      case ApplicationStatus.REVIEW:
      case ApplicationStatus.NEEDS_ATTENTION:
      case ApplicationStatus.MATCHED:
        return 0;
      case ApplicationStatus.INITIAL_SCREENING:
        return 1;
      case ApplicationStatus.CLIENT_ENDORSEMENT:
        return 2;
      case ApplicationStatus.FINAL_INTERVIEW:
        return 3;
      case ApplicationStatus.HIRED:
      case ApplicationStatus.ONBOARDING:
      case ApplicationStatus.COMPLIANCE:
        return 4;
      case ApplicationStatus.DEPLOYED:
        return 5;
      default:
        return -1;
    }
  };

  const activeIndex = getActiveIndex(currentStatus);
  const currentStageLabel =
    activeIndex >= 0 && activeIndex < CANONICAL_STAGES.length
      ? CANONICAL_STAGES[activeIndex].label
      : currentStatus;

  return (
    <div className={cn("w-full py-2 space-y-2", className)}>
      {/* Mobile Stage Summary pill */}
      <div className="md:hidden flex items-center justify-between gap-3 text-sm bg-slate-50 border border-slate-200 px-3 py-2 rounded-md">
        <span className="text-slate-600 font-medium">Progress</span>
        <span className="font-semibold text-teal-900 text-right">
          {activeIndex >= 0 ? `${activeIndex + 1} of ${CANONICAL_STAGES.length}: ${currentStageLabel}` : getApplicationStatusPresentation(currentStatus, audience).label}
        </span>
      </div>

      {/* Horizontal Scrollable Stepper Track */}
      <div className="overflow-x-auto pb-7 pt-2 no-scrollbar">
        <div className="min-w-[720px] px-4">
          <div className="flex items-center justify-between relative">
            {/* Progress Background Line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-full bg-slate-200 z-0" />

            {/* Dynamic Progress Fill Line */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-teal-600 z-0 transition-all duration-300"
              style={{
                width: `${Math.max(0, (activeIndex / (CANONICAL_STAGES.length - 1)) * 100)}%`,
              }}
            />

            {/* Step Nodes */}
            {CANONICAL_STAGES.map((stage, idx) => {
              const isCompleted = activeIndex > idx;
              const isCurrent = activeIndex === idx && !isTerminal;

              return (
                <div key={stage.id} className="relative z-10 flex flex-col items-center group">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all",
                      isCompleted
                        ? "bg-teal-700 border-teal-800 text-white"
                        : isCurrent
                        ? "bg-white border-teal-700 text-teal-800 ring-2 ring-teal-200 font-bold"
                        : "bg-white border-slate-400 text-slate-400"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <span
                    className={cn(
                      "absolute top-8 text-xs whitespace-nowrap text-center",
                      isCurrent
                        ? "text-teal-900 font-bold"
                        : isCompleted
                        ? "text-slate-700 font-semibold"
                        : "text-slate-400"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Terminal Status Alert banner if in non-linear state */}
      {isTerminal && (
        <div className="mt-2 px-3.5 py-2 bg-amber-50 border border-amber-300 flex items-center gap-2 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Current status: <strong>{getApplicationStatusPresentation(currentStatus, audience).label}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

