import React from "react";
import { Button } from "../ui/Button";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Shown instead of the buttons when no action fits every selected row. */
  emptyHint?: string;
  children?: React.ReactNode;
}

/** Appears above the list once rows are ticked. Buttons are the actions that are valid for every selected row. In flow, not sticky: the TA layout clips overflow, so a sticky bar would sit off screen. */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, onClear, emptyHint, children }) => {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-navy bg-navy-soft px-3 py-2"
    >
      <p role="status" className="text-sm font-semibold text-slate-950">
        {count} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {!children && emptyHint && <p className="text-sm text-slate-600">{emptyHint}</p>}
      </div>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        Clear selection
      </Button>
    </div>
  );
};
