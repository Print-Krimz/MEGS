import React, { useState } from "react";
import { Button, Dialog } from "../ui";

export interface MRFFileReviewRow {
  key: string;
  label: string;
  /** What the file says, already formatted for reading. */
  fileValue: string;
  /** What the form holds now. Null when the field is still empty. */
  currentValue: string | null;
}

interface MRFFileReviewDialogProps {
  rows: MRFFileReviewRow[];
  onFill: (keys: Set<string>) => void;
  onClose: () => void;
}

const valueClass = "whitespace-pre-line break-words text-xs text-[#486581] line-clamp-3";

/** Shows what was read from a manpower request file. Nothing reaches the form until the TA chooses Fill selected. */
export const MRFFileReviewDialog: React.FC<MRFFileReviewDialogProps> = ({ rows, onFill, onClose }) => {
  // Empty fields start ticked. Fields the TA already filled in stay as they are unless the TA ticks the file value.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.filter((row) => row.currentValue === null).map((row) => row.key)));

  const toggle = (key: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Review details from the file"
      description="Nothing is filled in until you choose Fill selected. Details you already entered are kept unless you tick the file value."
    >
      <div className="space-y-4">
        <ul className="divide-y divide-slate-200">
          {rows.map((row) => {
            const id = `mrf-file-${row.key}`;
            return (
              <li key={row.key} className="py-2">
                <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected.has(row.key)}
                    onChange={(e) => toggle(row.key, e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 rounded text-[#0B315D] focus:ring-[#0B315D]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {row.currentValue === null ? row.label : `Use the file value for ${row.label}`}
                    </span>
                    {row.currentValue !== null && <span className={`block ${valueClass}`}>Now: {row.currentValue}</span>}
                    <span className={`block ${valueClass}`}>{row.currentValue === null ? "From the file: " : "File: "}{row.fileValue}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={selected.size === 0} onClick={() => onFill(selected)}>
            Fill selected
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
