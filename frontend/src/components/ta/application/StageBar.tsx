import React, { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { Button } from "../../ui";
import { cn } from "../../../lib/utils";
import { formatTaStatus } from "../../../lib/ta-copy";
import type { StageAction } from "./stage-actions";
import type { NextStep } from "./next-step";

export interface StageBarProps {
  status: string;
  /** Replaces the stage name when the plain name would mislead, e.g. "Contract signed" before the start date. */
  stageLabel?: string;
  next: NextStep;
  primary: StageAction | null;
  secondary: StageAction | null;
  /** The action that is running (for the button spinner). */
  pendingActionId?: string | null;
  onAction: (action: StageAction) => void;
  /** Once a deployment exists, the bar links to it so the recruiter does not search Workforce. */
  deploymentId?: number | string | null;
  /** A quiet extra button, e.g. closing the application after the client declined. */
  extraAction?: { label: string; onClick: () => void } | null;
  /** Reports the rendered height so the resume column can sit below the bar. */
  onHeightChange?: (height: number) => void;
}

/**
 * The one place that says what to do next: the stage name, one sentence, and at most two buttons.
 * One row, sticky from md up; on phones it scrolls with the page so it never covers a form.
 * The sentence is a polite live region, so a screen reader hears the new step after an action.
 */
export const StageBar: React.FC<StageBarProps> = ({
  status,
  stageLabel,
  next,
  primary,
  secondary,
  pendingActionId,
  onAction,
  deploymentId,
  extraAction,
  onHeightChange,
}) => {
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

  const label = stageLabel ?? formatTaStatus(status);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={ref}
        aria-label="Stage and next step"
        className="z-20 rounded-md border border-slate-300 bg-white px-3 py-2 shadow-xs md:sticky md:top-14 sm:px-4"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="sr-only">Current stage: {label}</span>
            <div aria-live="polite" className="min-w-0">
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
          </div>

          {(primary || secondary || extraAction || deploymentId) && (
            <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              {deploymentId ? (
                <Button asChild variant={primary ? "outline" : "primary"} size="sm">
                  <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(deploymentId) }}>
                    Open deployment record
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              ) : null}
              {extraAction && (
                <Button variant="outline" size="sm" onClick={extraAction.onClick}>
                  {extraAction.label}
                </Button>
              )}
              {secondary && (
                <Button variant="outline" size="sm" onClick={() => onAction(secondary)} loading={pendingActionId === secondary.id}>
                  {secondary.label}
                </Button>
              )}
              {primary && (
                <Button variant="primary" size="sm" onClick={() => onAction(primary)} loading={pendingActionId === primary.id}>
                  {primary.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </section>
    </MotionConfig>
  );
};
