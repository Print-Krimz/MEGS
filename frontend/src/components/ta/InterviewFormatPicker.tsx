import React from "react";

export type InterviewFormatMode = "MANUAL" | "ONLINE_AUTO";

export interface InterviewFormatPickerProps {
  mode: InterviewFormatMode;
  onChange: (mode: InterviewFormatMode) => void;
  autoOnlineEnabled: boolean;
  /** Distinct summary note when Online (Auto-create link) is selected. */
  autoNote: string;
}

/**
 * Lets TA switch between entering a physical address / custom meeting URL and
 * letting MEGS generate a private online video link automatically (Initial Screening).
 */
export const InterviewFormatPicker: React.FC<InterviewFormatPickerProps> = ({
  mode,
  onChange,
  autoOnlineEnabled,
  autoNote,
}) => (
  <div className="space-y-2">
    <span className="block text-sm font-medium text-slate-800">Interview format</span>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Interview format">
      <button
        type="button"
        aria-pressed={mode === "MANUAL"}
        onClick={() => onChange("MANUAL")}
        className={`focus-ring min-h-11 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors md:min-h-9 ${
          mode === "MANUAL"
            ? "border-navy bg-navy text-white"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        }`}
      >
        Address or custom link
      </button>
      <button
        type="button"
        aria-pressed={mode === "ONLINE_AUTO"}
        disabled={!autoOnlineEnabled}
        onClick={() => onChange("ONLINE_AUTO")}
        className={`focus-ring min-h-11 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9 ${
          mode === "ONLINE_AUTO"
            ? "border-navy bg-navy text-white"
            : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
        }`}
      >
        Online (Auto-create link)
      </button>
    </div>
    {!autoOnlineEnabled && (
      <p className="text-xs text-slate-600">
        Automatic video rooms aren&apos;t configured. Paste a Google Meet or Zoom link below.
      </p>
    )}
    {mode === "ONLINE_AUTO" && (
      <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
        {autoNote}
      </p>
    )}
  </div>
);
