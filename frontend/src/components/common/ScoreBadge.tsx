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

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  threshold,
  size = "md",
  className,
}) => {
  const { data: config } = useGlobalConfig();
  const activeThreshold = threshold ?? config?.matchThreshold ?? config?.MATCH_THRESHOLD ?? 60;

  if (score === undefined || score === null || score === "") {
    return (
      <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs bg-slate-100 text-slate-500 border border-slate-300">
        N/A
      </span>
    );
  }

  const num = typeof score === "string" ? parseFloat(score) : score;
  // Green meets the recommend threshold, orange is within 25 points below it, red is further away.
  const isPassing = num >= activeThreshold;
  const isNear = num >= activeThreshold - NEAR_MARGIN;

  const colorStyles = isPassing
    ? "bg-emerald-100 text-emerald-900 border-emerald-500"
    : isNear
    ? "bg-orange-100 text-orange-900 border-orange-500"
    : "bg-rose-100 text-rose-900 border-rose-500";

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
