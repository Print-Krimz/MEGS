import React from "react";
import {
  getApplicationStatusPresentation,
  getDeploymentStatusMeta,
  getEmploymentStatusMeta,
  cn,
} from "../../lib/utils";

export interface StatusBadgeProps {
  status?: string | null;
  type?: "application" | "deployment" | "employment" | "raw";
  audience?: "applicant" | "staff";
  className?: string;
  size?: "sm" | "md";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "application",
  audience = "staff",
  className,
  size = "md",
}) => {
  let meta = { label: status || "Unknown", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };

  if (type === "application") {
    meta = getApplicationStatusPresentation(status, audience);
  } else if (type === "deployment") {
    meta = getDeploymentStatusMeta(status);
  } else if (type === "employment") {
    meta = getEmploymentStatusMeta(status);
  }

  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-medium border select-none shrink-0",
        sizeClass,
        meta.badgeClass,
        className
      )}
    >
      <span className="truncate">{meta.label}</span>
    </span>
  );
};
