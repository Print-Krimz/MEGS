import React, { useState } from "react";
import { cn } from "../../lib/utils";

export interface MaskedIdProps {
  value?: string | null;
  /** Noun used in the button label, e.g. "SSS number". */
  label?: string;
  revealable?: boolean;
  className?: string;
}

/** Shows a government ID as "•••• 4567" with an opt-in reveal. */
export const MaskedId: React.FC<MaskedIdProps> = ({ value, label = "ID number", revealable = true, className }) => {
  const [shown, setShown] = useState(false);
  const raw = value?.trim();
  if (!raw) return <span className={cn("text-slate-500", className)}>Not provided</span>;

  const digits = raw.replace(/\D/g, "");
  const masked = `•••• ${digits.slice(-4)}`;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="font-mono tabular-nums text-slate-900">{shown ? raw : masked}</span>
      {revealable && (
        <button
          type="button"
          aria-pressed={shown}
          aria-label={`${shown ? "Hide" : "Show"} full ${label}`}
          onClick={() => setShown((v) => !v)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-xs sm:min-h-6 sm:min-w-0 font-medium text-navy underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-navy"
        >
          {shown ? "Hide" : "Show"}
        </button>
      )}
    </span>
  );
};
