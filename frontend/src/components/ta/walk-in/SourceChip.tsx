import React from "react";
import { cn } from "../../../lib/utils";
import { TA_STATUS_TONE_CLASSES } from "../../../lib/ta-copy";
import type { ApplicationSource } from "../../../lib/types/application.types";

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  ONLINE: "Online",
  WALK_IN: "Walk-in",
};

/** Text chip for walk-in applications. Online rows show nothing. */
export const SourceChip: React.FC<{ source?: ApplicationSource | null; className?: string }> = ({ source, className }) => {
  if (!source || source === "ONLINE") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium",
        TA_STATUS_TONE_CLASSES.warning,
        className,
      )}
    >
      {APPLICATION_SOURCE_LABELS[source]}
    </span>
  );
};
