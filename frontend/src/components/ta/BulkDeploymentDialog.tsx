import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { FIELD_LIMITS, getManilaToday } from "../../lib/field-limits";

export type BulkDeploymentAction = "start" | "checkin";

export interface BulkDeploymentSubmission {
  /** Start: "each" keeps every worker's own contract start date; "same" uses `date` for all. */
  startMode: "each" | "same";
  /** Start: the shared date. Check-in: the next check-in date. */
  date: string;
  notes?: string;
}

interface BulkDeploymentDialogProps {
  action: BulkDeploymentAction | null;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: BulkDeploymentSubmission) => void;
}

const plural = (count: number) => (count === 1 ? "1 deployment" : `${count} deployments`);

/** Confirm site start or record a check-in for many deployments at once. */
export const BulkDeploymentDialog: React.FC<BulkDeploymentDialogProps> = ({ action, count, loading, onClose, onSubmit }) => {
  const [startMode, setStartMode] = useState<"each" | "same">("each");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!action) return;
    setStartMode("each");
    setDate(action === "start" ? getManilaToday() : "");
    setNotes("");
  }, [action]);

  if (!action) return null;
  const isStart = action === "start";
  const today = getManilaToday();
  const needsDate = !isStart || startMode === "same";
  const dateValid = !needsDate || (Boolean(date) && date >= today);

  return (
    <Dialog
      open
      onClose={onClose}
      title={isStart ? "Confirm site start" : "Record check-in"}
      description={
        isStart
          ? `${plural(count)} will be marked as started. Each employee is notified.`
          : `One check-in is recorded for each of ${plural(count)}, with the same next check-in date.`
      }
    >
      <div className="space-y-4">
        {isStart && (
          <Select
            label="First working date"
            value={startMode}
            onChange={(event) => setStartMode(event.target.value as "each" | "same")}
            options={[
              { value: "each", label: "Each worker's contract start date (today if it has passed)" },
              { value: "same", label: "One date for everyone" },
            ]}
          />
        )}
        {needsDate && (
          <DateField
            label={isStart ? "Date everyone starts" : "Next check-in date"}
            value={date}
            min={today}
            onChange={(event) => setDate(event.target.value)}
            help={date ? undefined : "Choose today or a later date."}
            required
          />
        )}
        <Textarea
          label={isStart ? "Notes (optional)" : "Check-in notes (optional)"}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={FIELD_LIMITS.notes}
          rows={3}
          placeholder="Added to every selected deployment."
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            disabled={!dateValid}
            onClick={() => onSubmit({ startMode, date, notes: notes.trim() || undefined })}
          >
            {isStart ? `Confirm ${count} ${count === 1 ? "start" : "starts"}` : `Save ${count} ${count === 1 ? "check-in" : "check-ins"}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
