import React, { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "../../ui";

export interface SkipToFinalDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  /** The reason is required: the backend records it in the audit trail. */
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
}

export const SkipToFinalDialog: React.FC<SkipToFinalDialogProps> = ({ open, onClose, candidateName, onSubmit, isSubmitting = false }) => {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTouched(false);
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Skip client review?" description={`${candidateName} goes straight to final interview without a client decision.`}>
      <div className="space-y-4">
        <Textarea
          label="Client instruction or recruitment rule"
          required
          placeholder="Why can this candidate skip client review?"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setTouched(true);
          }}
          error={touched && !reason.trim() ? "Enter the instruction or rule that allows this skip." : undefined}
          rows={3}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSubmitting} disabled={!reason.trim()} onClick={() => onSubmit(reason.trim())}>
            Skip to final interview
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
