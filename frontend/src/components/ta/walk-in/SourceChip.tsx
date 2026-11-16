import React from "react";
import { cn } from "../../../lib/utils";
import { TA_STATUS_TONE_CLASSES } from "../../../lib/ta-copy";
import type { ApplicationSource } from "../../../lib/types/application.types";
import { APPLICATION_SOURCE_LABELS } from "../../../lib/application-sources";

export { APPLICATION_SOURCE_LABELS };

/** Text chip for applications a recruiter added. Portal applications show nothing. Walk-ins stay amber. */
export const SourceChip: React.FC<{ source?: ApplicationSource | null; detail?: string | null; className?: string }> = ({ source, detail, className }) => {
  if (!source || source === "ONLINE") return null;
  return (
    <span
      title={detail ? `${APPLICATION_SOURCE_LABELS[source]}: ${detail}` : undefined}
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium",
        source === "WALK_IN" ? TA_STATUS_TONE_CLASSES.warning : "border-slate-300 bg-slate-100 text-slate-700",
        className,
      )}
    >
      {APPLICATION_SOURCE_LABELS[source]}
    </span>
  );
};
