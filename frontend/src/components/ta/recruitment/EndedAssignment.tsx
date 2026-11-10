import React from "react";
import { ApplicationStatus } from "../../../lib/types";
import { TA_STATUS_TONE_CLASSES } from "../../../lib/ta-copy";
import { cn, formatDate } from "../../../lib/utils";

type WithDeployments = { status: string; deployments?: Array<{ status: string; actualEnd?: string | null }> };

/**
 * A deployed application whose assignments have all ended (same rule as the backend's
 * ENDED_ASSIGNMENT_WHERE). Returns the latest end date, or null when the placement is not finished.
 */
export const getEndedAssignment = (app: WithDeployments): { endedAt: string | null } | null => {
  const deployments = app.deployments ?? [];
  if (app.status !== ApplicationStatus.DEPLOYED) return null;
  if (!deployments.some((d) => d.status === "ENDED")) return null;
  if (!deployments.every((d) => d.status === "ENDED" || d.status === "CANCELLED")) return null;
  const ends = deployments.map((d) => d.actualEnd).filter((d): d is string => Boolean(d)).sort();
  return { endedAt: ends.length ? ends[ends.length - 1] : null };
};

/** Grey "Ended" chip, sized like StatusBadge, for a finished placement. */
export const EndedBadge: React.FC<{ size?: "sm" | "md" }> = ({ size = "md" }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md border font-medium select-none shrink-0",
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
      TA_STATUS_TONE_CLASSES.neutral,
    )}
    title="This placement finished. It is kept as work history."
  >
    Ended
  </span>
);

/** "Deployed · ended Nov 10, 2026" under the chip. */
export const EndedNote: React.FC<{ endedAt: string | null }> = ({ endedAt }) => (
  <div className="mt-1 text-xs text-slate-600">
    Deployed{endedAt ? ` · ended ${formatDate(endedAt)}` : ""}
  </div>
);
