import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/Button";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  /** Shown instead of the buttons when no action fits every selected row. */
  emptyHint?: string;
  /**
   * Show a copy at the bottom of the screen once the bar has scrolled out of view, so a recruiter who ticked rows
   * far down the list does not have to scroll back up. Turn it off inside a dialog.
   */
  floating?: boolean;
  /** Says what the count covers, for example "on this page (28 in the list)". */
  note?: string;
  children?: React.ReactNode;
}

/**
 * Appears above the list once rows are ticked. Buttons are the actions that are valid for every selected row.
 *
 * It is not `position: sticky`: the TA layout clips horizontal overflow on its root, which stops sticky from
 * pinning to the screen. The floating copy is `fixed`, which does not depend on the layout.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({ count, onClear, emptyHint, floating = true, note, children }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [anchorVisible, setAnchorVisible] = useState(true);
  const active = count > 0;

  useEffect(() => {
    const node = anchorRef.current;
    if (!floating || !active || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setAnchorVisible(entry.isIntersecting));
    observer.observe(node);
    return () => {
      observer.disconnect();
      setAnchorVisible(true);
    };
  }, [floating, active]);

  if (!active) return null;

  const bar = (
    <>
      <p role="status" className="text-sm font-semibold text-slate-950">
        {count} selected
        {note && <span className="ml-1 font-normal text-slate-600">{note}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {!children && emptyHint && <p className="text-sm text-slate-600">{emptyHint}</p>}
      </div>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
        Clear selection
      </Button>
    </>
  );
  const floatingNow = floating && !anchorVisible;

  return (
    <>
      <div
        ref={anchorRef}
        role="region"
        aria-label="Bulk actions"
        aria-hidden={floatingNow || undefined}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-navy bg-navy-soft px-3 py-2"
      >
        {bar}
      </div>
      {floatingNow && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-navy bg-white px-3 py-2 shadow-modal lg:left-[17rem] lg:right-4"
        >
          {bar}
        </div>
      )}
    </>
  );
};
