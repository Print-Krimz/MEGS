import React, { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "../ui";
import type { RescheduleActivity, RescheduleRequest } from "../../lib/types/application.types";

export const REASON_MIN = 10;
export const REASON_MAX = 500;

const activityLabel = (activity: RescheduleActivity): string =>
  activity === "CONTRACT_SIGNING" ? "contract signing" : activity === "FINAL_INTERVIEW" ? "final interview" : "initial interview";

/** The newest request for one activity, whatever order the list arrives in. */
export const latestRequestFor = (
  requests: RescheduleRequest[] | undefined,
  activity: RescheduleActivity,
  interviewId?: number
): RescheduleRequest | undefined =>
  (requests ?? [])
    // An interview round has its own request; contract signing is one per application.
    .filter((r) => r.activity === activity && (interviewId === undefined || r.interviewId === interviewId))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

export interface RescheduleControlProps {
  activity: RescheduleActivity;
  /** The interview this appointment belongs to. Leave out for contract signing. */
  interviewId?: number;
  /** ISO time of the appointment. The button only shows while it is still ahead. */
  scheduledAt?: string | null;
  requests?: RescheduleRequest[];
  onRequest: (activity: RescheduleActivity) => void;
}

/**
 * Under an upcoming appointment: the "Request a new schedule" button, or one line saying why it is not available.
 * One change per activity: a waiting request or an approved one blocks another request.
 */
export const RescheduleControl: React.FC<RescheduleControlProps> = ({ activity, interviewId, scheduledAt, requests, onRequest }) => {
  const upcoming = Boolean(scheduledAt) && Date.parse(scheduledAt as string) > Date.now();
  if (!upcoming) return null;

  const latest = latestRequestFor(requests, activity, interviewId);
  const blockedText =
    latest?.status === "PENDING"
      ? "Request sent. Waiting for your recruiter."
      : latest?.status === "APPROVED"
      ? "You've already rescheduled once."
      : null;

  return (
    <div className="space-y-1.5 font-sans">
      {latest?.status === "REJECTED" && (
        <p className="text-xs text-[#486581]">
          Your recruiter kept the original schedule.
          {latest.decisionNote ? ` ${latest.decisionNote}` : ""}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={Boolean(blockedText)}
        aria-describedby={blockedText ? `reschedule-blocked-${activity}-${interviewId ?? "contract"}` : undefined}
        onClick={() => onRequest(activity)}
      >
        Request a new schedule
      </Button>
      {blockedText && (
        <p id={`reschedule-blocked-${activity}-${interviewId ?? "contract"}`} className="text-xs text-[#486581]">
          {blockedText}
        </p>
      )}
    </div>
  );
};

export interface RescheduleRequestDialogProps {
  open: boolean;
  onClose: () => void;
  activity: RescheduleActivity | null;
  onSubmit: (reason: string) => void;
  isSubmitting?: boolean;
}

export const RescheduleRequestDialog: React.FC<RescheduleRequestDialogProps> = ({
  open,
  onClose,
  activity,
  onSubmit,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);

  const length = reason.trim().length;
  const error = touched && length < REASON_MIN ? `Enter at least ${REASON_MIN} characters (${length} / ${REASON_MAX}).` : undefined;

  const submit = () => {
    setTouched(true);
    if (length < REASON_MIN) return;
    onSubmit(reason.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request a new schedule"
      description={activity ? `Tell your recruiter why you need to move your ${activityLabel(activity)}.` : undefined}
    >
      <div className="space-y-4">
        <Textarea
          label="Reason for rescheduling"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          maxLength={REASON_MAX}
          rows={4}
          required
          error={error}
          helperText={`${length} / ${REASON_MAX} characters`}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSubmitting} onClick={submit}>
            Send request
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
