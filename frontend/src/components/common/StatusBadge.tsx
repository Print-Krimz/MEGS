import React from "react";
import {
  getApplicationStatusPresentation,
  getDeploymentStatusMeta,
  getEmploymentStatusMeta,
  cn,
} from "../../lib/utils";
import {
  TA_STATUS_TONE_CLASSES,
  TA_STATUS_TONE_TEXT_CLASSES,
  formatPriority,
  formatTaStatus,
  getTargetDateTone,
  getTaStatusTone,
} from "../../lib/ta-copy";

export interface StatusBadgeProps {
  status?: string | null;
  type?: "application" | "deployment" | "employment" | "priority" | "targetDate" | "raw";
  audience?: "applicant" | "staff";
  className?: string;
  size?: "sm" | "md";
  appearance?: "badge" | "text";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = "application",
  audience = "staff",
  className,
  size = "md",
  appearance = "badge",
}) => {
  let meta = {
    label: status ? formatTaStatus(status) : "Unknown",
    badgeClass: TA_STATUS_TONE_CLASSES[getTaStatusTone(status)],
  };

  if (type === "application") {
    meta = getApplicationStatusPresentation(status, audience);
  } else if (type === "deployment") {
    meta = getDeploymentStatusMeta(status);
  } else if (type === "employment") {
    meta = getEmploymentStatusMeta(status);
  } else if (type === "priority") {
    meta = {
      label: formatPriority(status),
      badgeClass: TA_STATUS_TONE_CLASSES[getTaStatusTone(status)],
    };
  } else if (type === "targetDate") {
    meta = {
      label: status || "ASAP",
      badgeClass: TA_STATUS_TONE_CLASSES[getTargetDateTone(status)],
    };
  }

  const sizeClass = appearance === "text"
    ? (size === "sm" ? "text-xs" : "text-sm")
    : size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";
  const textClass = type === "priority"
    ? TA_STATUS_TONE_TEXT_CLASSES[getTaStatusTone(status)]
    : type === "targetDate"
    ? TA_STATUS_TONE_TEXT_CLASSES[getTargetDateTone(status)]
    : undefined;

  return (
    <span
      className={cn(
        appearance === "text"
          ? "inline-flex items-center justify-center text-center font-semibold select-none shrink-0"
          : "inline-flex items-center rounded-md font-medium border select-none shrink-0",
        sizeClass,
        appearance === "text" ? textClass : meta.badgeClass,
        className
      )}
    >
      <span className="truncate">{meta.label}</span>
    </span>
  );
};
