import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { REJECTION_REASON_OPTIONS, type ClosureDisposition } from "../../lib/backout";

export type BulkApplicationAction = "move" | "reject" | "archive" | "restore";

export interface BulkSubmission {
  /** Archive and restore. */
  reason?: string;
  /** Reject. */
  reasonCode?: string;
  disposition?: ClosureDisposition;
  notes?: string;
}

interface BulkApplicationsDialogProps {
  action: BulkApplicationAction | null;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: BulkSubmission) => void;
}

export const BULK_ACTION_TITLES: Record<BulkApplicationAction, string> = {
  move: "Move to Initial Screening",
  reject: "Reject applicants",
  archive: "Archive applications",
  restore: "Restore applications",
};

const plural = (count: number) => (count === 1 ? "1 application" : `${count} applications`);

/** One dialog for every bulk action on the Applications list. Only the fields differ. */
export const BulkApplicationsDialog: React.FC<BulkApplicationsDialogProps> = ({ action, count, loading, onClose, onSubmit }) => {
  const [reasonCode, setReasonCode] = useState("");
  const [disposition, setDisposition] = useState<ClosureDisposition>("ARCHIVE");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!action) return;
    setReasonCode("");
    setDisposition("ARCHIVE");
    setNotes("");
    setReason("");
  }, [action]);

  if (!action) return null;

  const notesRequired = action === "reject" && reasonCode === "OTHER";
  const notesMissing = notesRequired && !notes.trim();
  const ready =
    action === "move" ||
    (action === "reject" && Boolean(reasonCode) && !notesMissing) ||
    ((action === "archive" || action === "restore") && Boolean(reason.trim()));

  const description = {
    move: `${plural(count)} will move to Initial Screening. Each applicant is notified.`,
    reject: `${plural(count)} will be rejected with the same reason. Each applicant is notified. Records that cannot be rejected are listed afterward.`,
    archive: `${plural(count)} will be archived with the same reason.`,
    restore: `${plural(count)} will return to the pipeline as Submitted.`,
  }[action];

  const submitLabel = {
    move: `Move ${count}`,
    reject: `Reject ${count}`,
    archive: `Archive ${count}`,
    restore: `Restore ${count}`,
  }[action];

  const submit = () => {
    if (action === "reject") onSubmit({ reasonCode, disposition, notes: notes.trim() || undefined });
    else if (action === "archive" || action === "restore") onSubmit({ reason: reason.trim() });
    else onSubmit({});
  };

  return (
    <Dialog open onClose={onClose} title={BULK_ACTION_TITLES[action]} description={description}>
      <div className="space-y-4">
        {action === "reject" && (
          <>
            <Select
              label="Reason"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder="Select a reason"
              options={REJECTION_REASON_OPTIONS}
            />
            <Select
              label="What should happen to these applicants"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as ClosureDisposition)}
              options={[
                { value: "ARCHIVE", label: "Archive (no longer considered for active recruitment)" },
                { value: "TALENT_POOL", label: "Talent Pool (may qualify for future openings)" },
              ]}
            />
            <Textarea
              label={notesRequired ? "Notes" : "Notes (optional)"}
              placeholder="Add details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required={notesRequired}
              maxLength={FIELD_LIMITS.notes}
              error={notesMissing ? "Please describe the reason." : undefined}
              rows={3}
            />
          </>
        )}
        {(action === "archive" || action === "restore") && (
          <Textarea
            label="Reason for this change"
            placeholder={
              action === "archive"
                ? "e.g. Position filled, candidate unresponsive, or withdrew application"
                : "e.g. Candidate recontacted and available for consideration"
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={FIELD_LIMITS.notes}
            rows={3}
            required
          />
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={action === "reject" ? "danger" : "primary"}
            size="sm"
            loading={loading}
            disabled={!ready}
            onClick={submit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
