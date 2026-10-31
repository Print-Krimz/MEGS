import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { FIELD_LIMITS, getManilaToday } from "../../lib/field-limits";

export interface BulkDeploymentSubmission {
  /** "each" keeps every worker's own contract start date; "same" uses `date` for all. */
  startMode: "each" | "same";
  /** The shared start date. */
  date: string;
  notes: string;
}

interface BulkDeploymentDialogProps {
  open: boolean;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: BulkDeploymentSubmission) => void;
}

const plural = (count: number) => (count === 1 ? "1 deployment" : `${count} deployments`);

/** Confirm site start for many deployments at once. */
export const BulkDeploymentDialog: React.FC<BulkDeploymentDialogProps> = ({ open, count, loading, onClose, onSubmit }) => {
  const [startMode, setStartMode] = useState<"each" | "same">("each");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setStartMode("each");
    setDate(getManilaToday());
    setNotes("");
  }, [open]);

  if (!open) return null;
  const today = getManilaToday();
  const needsDate = startMode === "same";
  const dateValid = !needsDate || (Boolean(date) && date >= today);
  const notesValid = notes.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Confirm start date"
      description={`${plural(count)} will start on the date below. Anyone with a future date stays Ready to start and becomes Active on site that day. Each employee is notified.`}
    >
      <div className="space-y-4">
        <Select
          label="First working date"
          value={startMode}
          onChange={(event) => setStartMode(event.target.value as "each" | "same")}
          options={[
            { value: "each", label: "Each worker's contract start date (today if it has passed)" },
            { value: "same", label: "One date for everyone" },
          ]}
        />
        {needsDate && (
          <DateField
            label="Date everyone starts"
            value={date}
            min={today}
            onChange={(event) => setDate(event.target.value)}
            help={date ? undefined : "Choose today or a later date."}
            required
          />
        )}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={FIELD_LIMITS.notes}
          rows={3}
          placeholder="Added to every selected deployment."
          required
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            disabled={!dateValid || !notesValid}
            onClick={() => onSubmit({ startMode, date, notes: notes.trim() })}
          >
            {`Confirm ${count} ${count === 1 ? "start" : "starts"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
