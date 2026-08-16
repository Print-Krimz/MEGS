import React from "react";
import {
  getApplicationStatusMeta,
  getDeploymentStatusMeta,
  getEmploymentStatusMeta,
  cn,
} from "../../lib/utils";

export interface StatusBadgeProps {
  status?: string | null;
  type?: "application" | "deployment" | "employment" | "raw";
  className?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "application",
  className,
  size = "md",
}) => {
  let meta = { label: status || "Unknown", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };

  if (type === "application") {
    meta = getApplicationStatusMeta(status);
  } else if (type === "deployment") {
    meta = getDeploymentStatusMeta(status);
  } else if (type === "employment") {
    meta = getEmploymentStatusMeta(status);
  }

  const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]";

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-bold uppercase border tracking-wider select-none shrink-0",
        sizeClass,
        meta.badgeClass,
        className
      )}
    >
      <span className="w-1.5 h-1.5 bg-current mr-1.5 opacity-80 shrink-0" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
};
