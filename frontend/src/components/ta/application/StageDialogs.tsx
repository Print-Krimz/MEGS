import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Dialog, Select, Textarea } from "../../ui";

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

export interface FastTrackDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  onSubmit: (targetStage: "FINAL_INTERVIEW" | "COMPLIANCE") => void;
  isSubmitting?: boolean;
}

export const FastTrackDialog: React.FC<FastTrackDialogProps> = ({ open, onClose, candidateName, onSubmit, isSubmitting = false }) => {
  const [target, setTarget] = useState<"FINAL_INTERVIEW" | "COMPLIANCE">("COMPLIANCE");

  useEffect(() => {
    if (open) setTarget("COMPLIANCE");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Fast-track redeployment"
      description={`Move ${candidateName} straight to a later stage. Valid clearances approved in the last 12 months are carried over.`}
    >
      <div className="space-y-4">
        <div className="space-y-1 rounded-lg border border-navy-line bg-navy-soft p-3 text-sm text-slate-800">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4 text-navy" aria-hidden="true" />
            12-month clearance carryover
          </p>
          <p>
            Clearances approved within the last 12 months that have not expired are carried into this application as approved. Everything else must still be submitted and reviewed.
          </p>
        </div>
        <Select
          label="Advance directly to"
          value={target}
          onChange={(e) => setTarget(e.target.value as "FINAL_INTERVIEW" | "COMPLIANCE")}
          options={[
            { value: "COMPLIANCE", label: "Requirements (recommended)" },
            { value: "FINAL_INTERVIEW", label: "Final interview" },
          ]}
        />
        <p className="text-xs text-slate-600">
          {target === "COMPLIANCE"
            ? "Skips initial review, client review and the final interview. Requirements and contract signing still apply."
            : "Skips initial review and client review."}
        </p>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSubmitting} onClick={() => onSubmit(target)}>
            Confirm fast-track
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
