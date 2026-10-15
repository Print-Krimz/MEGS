import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { APPLICANT_SELF_REASONS, BACKOUT_REASON_LABELS } from "../../lib/backout";
import { FIELD_LIMITS } from "../../lib/field-limits";

export interface BackoutSubmission {
  reason: string;
  notes?: string;
}

interface BackoutDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BackoutSubmission) => void;
  loading?: boolean;
}

/** Self-service withdrawal for an applicant. Staff close applications with CloseApplicationDialog instead. */
export const BackoutDialog: React.FC<BackoutDialogProps> = ({ open, onClose, onSubmit, loading }) => {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  // "Other" must be explained; the backend refuses it without notes too.
  const notesRequired = reason === "OTHER";
  const notesMissing = notesRequired && !notes.trim();

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNotes("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Withdraw application"
      description="Tell us why you are withdrawing. This closes your application and cannot be undone."
    >
      <div className="space-y-4">
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Select a reason"
          options={APPLICANT_SELF_REASONS.map((r) => ({ value: r, label: BACKOUT_REASON_LABELS[r] ?? r }))}
        />
        <Textarea
          label={notesRequired ? "Notes" : "Notes (optional)"}
          required={notesRequired}
          placeholder="Add details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={FIELD_LIMITS.notes}
          error={notesMissing ? "Please describe the reason." : undefined}
          rows={3}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            disabled={!reason || notesMissing}
            onClick={() => onSubmit({ reason, notes: notes.trim() || undefined })}
          >
            Withdraw application
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
