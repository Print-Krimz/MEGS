import React from "react";
import { Sparkles } from "lucide-react";
import { formatScore, cn } from "../../lib/utils";
import { useGlobalConfig } from "../../lib/config";

export interface ScoreBadgeProps {
  score?: number | string | null;
  threshold?: number;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  threshold,
  showIcon = true,
  size = "md",
  className,
}) => {
  const { data: config } = useGlobalConfig();
  const activeThreshold = threshold ?? config?.matchThreshold ?? config?.MATCH_THRESHOLD ?? 60;

  if (score === undefined || score === null || score === "") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-mono bg-slate-100 text-slate-500 border border-slate-300">
        N/A
      </span>
    );
  }

  const num = typeof score === "string" ? parseFloat(score) : score;
  const isHigh = num >= 75;
  const isPassing = num >= activeThreshold;

  const colorStyles = isHigh
    ? "bg-emerald-50 text-emerald-900 border-emerald-400"
    : isPassing
    ? "bg-amber-50 text-amber-900 border-amber-400"
    : "bg-rose-50 text-rose-900 border-rose-400";

  const sizeStyles = {
    sm: "px-1.5 py-0.5 text-[11px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm font-bold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono font-bold border tabular-nums select-none",
        colorStyles,
        sizeStyles[size],
        className
      )}
      title={`Job Match Score: ${formatScore(num)} / 100`}
    >
      {showIcon && <Sparkles className="w-3 h-3 opacity-80 shrink-0" />}
      <span>{formatScore(num)}</span>
      <span className="text-[9px] font-normal opacity-70 font-mono">/100</span>
    </span>
  );
};
