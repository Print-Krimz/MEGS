import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { TA_STATUS_TONE_CLASSES, type TAStatusTone } from "../../lib/ta-copy";

/** Status chip with a fixed label, in the same tones and shape as the TA StatusBadge. */
export const ToneBadge: React.FC<{ tone: TAStatusTone; children: React.ReactNode; className?: string }> = ({ tone, children, className }) => (
  <span className={cn("inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium", TA_STATUS_TONE_CLASSES[tone], className)}>
    {children}
  </span>
);

/** Inline result of a save or change, shown above the content it refers to. */
export const FeedbackBanner: React.FC<{ type: "success" | "error"; message: React.ReactNode; onDismiss: () => void }> = ({ type, message, onDismiss }) => (
  <div
    role={type === "error" ? "alert" : "status"}
    aria-live="polite"
    className={cn(
      "flex items-center justify-between gap-3 rounded-md border py-1 pl-3.5 pr-1 text-sm",
      type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
    )}
  >
    <span className="py-2">{message}</span>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss message"
      className="focus-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white/60 hover:text-slate-800 md:min-h-9 md:min-w-9"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
);
