import React from "react";
import { formatScore, cn } from "../../lib/utils";
import { useGlobalConfig } from "../../lib/config";

export interface ScoreBadgeProps {
  score?: number | string | null;
  threshold?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const NEAR_MARGIN = 25;
const DEFAULT_THRESHOLD = 60;

export type ScoreBand = "high" | "near" | "low";

/** High meets the recommend threshold, near is within 25 points below it, low is further away. */
// oxlint-disable-next-line react/only-export-components -- pure helper shared with the redeployment tags
export const scoreBand = (score: number, threshold: number): ScoreBand =>
  score >= threshold ? "high" : score >= threshold - NEAR_MARGIN ? "near" : "low";

/** The configured recommend threshold, the same one ScoreBadge uses. */
// oxlint-disable-next-line react/only-export-components -- hook shares the badge threshold lookup
export const useMatchThreshold = (threshold?: number) => {
  const { data: config } = useGlobalConfig();
  return threshold ?? config?.matchThreshold ?? config?.MATCH_THRESHOLD ?? DEFAULT_THRESHOLD;
};

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  threshold,
  size = "md",
  className,
}) => {
  const activeThreshold = useMatchThreshold(threshold);

  if (score === undefined || score === null || score === "") {
    return (
      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 border border-slate-300">
        N/A
      </span>
    );
  }

  const num = typeof score === "string" ? parseFloat(score) : score;
  const colorStyles = {
    high: "bg-emerald-100 text-emerald-900 border-emerald-500",
    near: "bg-orange-100 text-orange-900 border-orange-500",
    low: "bg-rose-100 text-rose-900 border-rose-500",
  }[scoreBand(num, activeThreshold)];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-sm",
    md: "px-2.5 py-1 text-base",
    lg: "px-3 py-1.5 text-xl",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md gap-1 font-extrabold border-2 tabular-nums select-none",
        colorStyles,
        sizeStyles[size],
        className
      )}
      title={`Match score: ${formatScore(num)} out of 100`}
    >
      <span>{Math.round(num)}</span>
      <span className="text-xs font-medium opacity-75">/100</span>
    </span>
  );
};
