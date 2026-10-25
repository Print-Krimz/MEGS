import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { FIELD_LIMITS, getManilaToday, toManilaDateInput } from "../../lib/field-limits";
import { TA_COPY } from "../../lib/ta-copy";
import { formatDate } from "../../lib/utils";

export type EndDisposition = "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED";

export interface BulkEndSubmission {
  actualEnd: string;
  reason: string;
  disposition: EndDisposition;
}

export interface BulkEndWorker {
  id: number;
  name: string;
  /** Recorded first working date. The shared last working date cannot be earlier than any of these. */
  actualStart?: string | null;
}

interface BulkEndAssignmentDialogProps {
  open: boolean;
  workers: BulkEndWorker[];
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: BulkEndSubmission) => void;
}

const DISPOSITION_HELP: Record<EndDisposition, string> = {
  AVAILABLE_FOR_REDEPLOYMENT: "Everyone appears in the Redeployment queue.",
  NOT_CONFIRMED: "Everyone stays out of the Redeployment queue until you update their employee record.",
  SEPARATED: "Everyone is marked as separated from the agency. This cannot be undone from here.",
};

/** End several active assignments with one date, one reason and one next step. */
export const BulkEndAssignmentDialog: React.FC<BulkEndAssignmentDialogProps> = ({ open, workers, loading, onClose, onSubmit }) => {
  const today = getManilaToday();
  const [actualEnd, setActualEnd] = useState(today);
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<EndDisposition | "">("");
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActualEnd(getManilaToday());
    setReason("");
    setDisposition("");
    setUnderstood(false);
  }, [open]);

  // The shared date has to suit the worker who started last.
  const earliestEnd = workers.map((w) => toManilaDateInput(w.actualStart)).filter(Boolean).sort().at(-1) ?? "";
  const startsLater = earliestEnd > today;
  const separated = disposition === "SEPARATED";
  const count = workers.length;

  const missing = startsLater
    ? "Someone has not started yet."
    : !actualEnd
      ? "Enter the last working date."
      : !disposition
        ? "Choose what happens next."
        : !reason.trim()
          ? "Add a reason."
          : separated && !understood
            ? "Confirm that leaving the agency cannot be undone."
            : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="End assignments"
      description={`The same last working date, next step and reason are recorded for ${count} ${count === 1 ? "worker" : "workers"}. Workers who cannot be ended are listed afterward.`}
    >
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">Ending</p>
          <ul className="max-h-32 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-300 text-sm">
            {workers.map((worker) => (
              <li key={worker.id} className="px-3 py-1.5 text-slate-900">
                {worker.name}
              </li>
            ))}
          </ul>
        </div>
        {startsLater ? (
          <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            At least one selected worker starts on {formatDate(earliestEnd)}. An assignment can only be ended from its start date.
          </p>
        ) : (
          <DateField
            label="Actual last working date"
            value={actualEnd}
            min={earliestEnd || undefined}
            max={today}
            onChange={(event) => setActualEnd(event.target.value)}
            help={earliestEnd ? `Not earlier than ${formatDate(earliestEnd)}, when the last worker started.` : undefined}
            required
          />
        )}
        <div className="space-y-1">
          <Select
            label="Workers' next step"
            value={disposition}
            onChange={(event) => {
              setDisposition(event.target.value as EndDisposition | "");
              setUnderstood(false);
            }}
            options={[
              { value: "", label: "Choose what happens next" },
              { value: "AVAILABLE_FOR_REDEPLOYMENT", label: TA_COPY.workforce.dispositions.wantsAnother },
              { value: "NOT_CONFIRMED", label: TA_COPY.workforce.dispositions.notConfirmed },
              { value: "SEPARATED", label: TA_COPY.workforce.dispositions.leaving },
            ]}
          />
          {disposition && <p className="text-xs text-slate-600">{DISPOSITION_HELP[disposition]}</p>}
        </div>
        {separated && (
          <label className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-400"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            <span>I understand that marking {count === 1 ? "this worker" : `these ${count} workers`} as separated cannot be undone from here.</span>
          </label>
        )}
        <Textarea
          label="Reason for ending these assignments"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={FIELD_LIMITS.notes}
          rows={3}
          required
          placeholder="For example: client project finished"
        />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
          {missing && <span className="text-xs text-slate-600">{missing}</span>}
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            disabled={Boolean(missing)}
            onClick={() => disposition && onSubmit({ actualEnd, reason: reason.trim(), disposition })}
          >
            {`End ${count} ${count === 1 ? "assignment" : "assignments"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
