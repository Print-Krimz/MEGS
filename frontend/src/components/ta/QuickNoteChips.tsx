import React from "react";
import type { NotePreset } from "../../lib/ta-note-presets";

export interface QuickNoteChipsProps {
  presets: readonly NotePreset[];
  currentValue: string;
  onSelect: (text: string) => void;
  label?: string;
}

export const QuickNoteChips: React.FC<QuickNoteChipsProps> = ({
  presets,
  currentValue,
  onSelect,
  label = "Quick notes",
}) => {
  if (presets.length === 0) return null;

  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = currentValue.trim() === preset.text;
          return (
            <button
              key={preset.label}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(preset.text)}
              className={`focus-ring min-h-11 rounded border px-2.5 py-1 text-xs font-medium transition-colors md:min-h-8 ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
