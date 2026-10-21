import React, { useEffect, useRef } from "react";
import { MotionConfig, motion } from "motion/react";
import { PipelineIndicator, StatusBadge } from "../../common";
import { Button } from "../../ui";
import { cn } from "../../../lib/utils";
import { formatTaStatus } from "../../../lib/ta-copy";
import type { StageAction } from "./stage-actions";
import type { NextStep } from "./next-step";

export interface StageBarProps {
  status: string;
  next: NextStep;
  primary: StageAction | null;
  secondary: StageAction | null;
  /** The action that is running (for the button spinner). */
  pendingActionId?: string | null;
  onAction: (action: StageAction) => void;
  skippedStages: { stage: string; reason?: string | null; actorEmail?: string | null; at?: string | null }[];
  /** Reports the rendered height so the resume column can sit below the bar. */
  onHeightChange?: (height: number) => void;
}

/**
 * The one place that says where the application is and what to do next:
 * stage chip, one "Next:" sentence, the stepper, and at most two buttons.
 * Sticky from md up; on phones it scrolls with the page so it never covers a form.
 */
export const StageBar: React.FC<StageBarProps> = ({ status, next, primary, secondary, pendingActionId, onAction, skippedStages, onHeightChange }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeightChange || typeof ResizeObserver === "undefined") return;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const stageLabel = formatTaStatus(status);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={ref}
        aria-label="Stage and next step"
        className="z-20 border border-slate-300 bg-white p-3 shadow-xs md:sticky md:top-14 sm:p-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="sr-only">Current stage: {stageLabel}</span>
            <StatusBadge status={status} size="md" />
            {next.text && (
              <motion.p
                key={next.text}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn("min-w-0 text-sm", next.needsTa ? "font-medium text-slate-950" : "text-slate-700")}
              >
                {next.text}
              </motion.p>
            )}
          </div>

          {(primary || secondary) && (
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              {secondary && (
                <Button variant="outline" size="md" onClick={() => onAction(secondary)} loading={pendingActionId === secondary.id}>
                  {secondary.label}
                </Button>
              )}
              {primary && (
                <Button variant="primary" size="md" onClick={() => onAction(primary)} loading={pendingActionId === primary.id}>
                  {primary.label}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
          <PipelineIndicator
            variant="compact"
            currentStatus={status}
            hideTerminalAlert
            currentLabel={stageLabel}
            skippedStages={skippedStages}
          />
        </div>
      </section>
    </MotionConfig>
  );
};
