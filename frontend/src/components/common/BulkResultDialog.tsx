import React from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import type { BulkSummary } from "../../lib/types/application.types";

interface BulkResultDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: BulkSummary | null;
  /** Name shown for a record in the failure list. */
  labelFor: (id: number) => string;
}

/** Shown when some rows could not be processed or need a second look, so the recruiter sees which ones and why. */
export const BulkResultDialog: React.FC<BulkResultDialogProps> = ({ open, onClose, title, summary, labelFor }) => {
  const listed = summary?.results.filter((row) => !row.ok || row.reason) ?? [];
  const needsLook = summary?.results.filter((row) => row.ok && row.reason).length ?? 0;
  return (
    <Dialog
      open={open && Boolean(summary)}
      onClose={onClose}
      title={title}
      description={
        summary
          ? [
              `${summary.succeeded} done`,
              summary.failed > 0 ? `${summary.failed} could not be processed` : null,
              needsLook > 0 ? `${needsLook} need a look` : null,
            ]
              .filter(Boolean)
              .join(", ") + (summary.failed > 0 ? ". The failed records stay selected." : ".")
          : undefined
      }
    >
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-300">
        {listed.map((row) => (
          <li key={row.id} className="px-3 py-2 text-sm">
            <p className="font-medium text-slate-950">{labelFor(row.id)}</p>
            <p className="text-slate-600">{row.reason}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
};
