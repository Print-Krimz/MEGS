import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button, Dialog } from "../../ui";
import { WalkInSlip } from "./WalkInSlip";
import type { WalkInSlip as WalkInSlipData } from "../../../lib/types/application.types";

export const SLIPS_PER_PAGE = 8;

const chunk = <T,>(items: T[], size: number): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
};

interface WalkInSlipSheetProps {
  slips: WalkInSlipData[];
}

/** A4 pages of slips, 2 across and 4 down, with dashed cut lines. Hidden on screen; only printing shows it. */
export const WalkInSlipSheet: React.FC<WalkInSlipSheetProps> = ({ slips }) => {
  const pages = useMemo(() => chunk(slips, SLIPS_PER_PAGE), [slips]);
  const printedAt = useMemo(() => new Date().toISOString(), []);
  return (
    <div className="print-slip-sheet hidden print:block">
      {pages.map((page, index) => (
        <section
          key={index}
          data-slip-page
          className="box-border h-[297mm] w-[210mm] break-after-page p-[6mm] last:break-after-auto"
        >
          <div className="grid h-full grid-cols-2 grid-rows-4 border-l border-t border-dashed border-slate-500">
            {page.map((slip) => (
              <WalkInSlip key={slip.applicationId} sheet slip={slip} printedAt={printedAt} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

interface WalkInSlipSheetDialogProps {
  open: boolean;
  slips: WalkInSlipData[];
  onClose: () => void;
}

export const WalkInSlipSheetDialog: React.FC<WalkInSlipSheetDialogProps> = ({ open, slips, onClose }) => {
  // The single slip prints on 80 mm paper. While this dialog is open the page size is A4 instead.
  useEffect(() => {
    if (!open) return;
    const style = document.createElement("style");
    style.media = "print";
    style.textContent = "@page { size: A4; margin: 0; }";
    document.head.appendChild(style);
    return () => style.remove();
  }, [open]);

  const pageCount = Math.max(1, Math.ceil(slips.length / SLIPS_PER_PAGE));

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Print all slips"
        description={`${slips.length} ${slips.length === 1 ? "slip" : "slips"} on ${pageCount} A4 ${pageCount === 1 ? "page" : "pages"}, ${SLIPS_PER_PAGE} to a page. Cut along the dashed lines.`}
        size="md"
      >
        <div className="space-y-4">
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 text-sm">
            {slips.map((slip) => (
              <li key={slip.applicationId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 break-words">
                  <span className="font-medium text-slate-900">{slip.applicantName}</span>
                  <span className="text-slate-600"> · {slip.jobTitle}</span>
                </span>
                <span className="font-semibold tabular-nums text-slate-900">{slip.trackingCode}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => window.print()}>Print slips</Button>
          </div>
        </div>
      </Dialog>
      {open && createPortal(<WalkInSlipSheet slips={slips} />, document.body)}
    </>
  );
};
