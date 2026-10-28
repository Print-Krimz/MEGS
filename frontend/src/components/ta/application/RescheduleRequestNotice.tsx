import React, { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "../../ui";
import { formatDateTime } from "../../../lib/utils";
import type { RescheduleActivity, RescheduleRequest } from "../../../lib/types/application.types";

const MAX_NOTE = 2000;

export const rescheduleActivityLabel = (activity: RescheduleActivity | string): string =>
  activity === "CONTRACT_SIGNING" ? "contract signing" : activity === "FINAL_INTERVIEW" ? "final interview" : "initial interview";

export interface RescheduleRequestNoticeProps {
  candidateName: string;
  request: RescheduleRequest;
  /** The appointment's current time (falls back to the time stored on the request). */
  currentScheduledAt?: string | null;
  onPickTime: (request: RescheduleRequest) => void;
  onDecline: (request: RescheduleRequest) => void;
}

/** One waiting reschedule request: who asked, why, the current time, and the two answers. */
export const RescheduleRequestNotice: React.FC<RescheduleRequestNoticeProps> = ({
  candidateName,
  request,
  currentScheduledAt,
  onPickTime,
  onDecline,
}) => {
  const current = currentScheduledAt || request.previousScheduledAt;
  return (
    <div role="status" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">
        {candidateName} asked to reschedule the {rescheduleActivityLabel(request.activity)}
      </p>
      <p className="whitespace-pre-line">{request.reason}</p>
      {current && (
        <p>
          <span className="text-amber-900">Current time: </span>
          <span className="font-medium tabular-nums">{formatDateTime(current)}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="primary" size="sm" onClick={() => onPickTime(request)}>
          Pick new time
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDecline(request)}>
          Decline
        </Button>
      </div>
    </div>
  );
};

export interface DeclineRescheduleDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  activity?: RescheduleActivity | null;
  onSubmit: (decisionNote?: string) => void;
  isSubmitting?: boolean;
}

export const DeclineRescheduleDialog: React.FC<DeclineRescheduleDialogProps> = ({
  open,
  onClose,
  candidateName,
  activity,
  onSubmit,
  isSubmitting = false,
}) => {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Decline reschedule request"
      description={`${candidateName} will keep the current ${activity ? rescheduleActivityLabel(activity) : "schedule"}.`}
    >
      <div className="space-y-4">
        <Textarea
          label="Note for the applicant (optional)"
          placeholder="e.g. The panel is only available at this time."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE}
          rows={3}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" loading={isSubmitting} onClick={() => onSubmit(note.trim() || undefined)}>
            Decline request
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
