import React, { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Textarea } from "../ui/Textarea";

interface BulkReasonDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  submitLabel: string;
  loading?: boolean;
  /** Matches the backend limit for the action. */
  maxLength?: number;
  placeholder?: string;
  onSubmit: (reason: string) => void;
}

/** Asks for one reason that applies to every selected record. */
export const BulkReasonDialog: React.FC<BulkReasonDialogProps> = ({
  open,
  onClose,
  title,
  description,
  submitLabel,
  loading,
  maxLength = 300,
  placeholder,
  onSubmit,
}) => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description} size="sm">
      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim()) onSubmit(reason.trim());
        }}
      >
        <Textarea
          label="Reason"
          required
          rows={3}
          maxLength={maxLength}
          placeholder={placeholder}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={loading} disabled={!reason.trim()}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
