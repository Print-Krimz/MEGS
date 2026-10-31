import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { Button, Dialog, Input, DateTimePicker, dateTimeLocalToManilaIso, isWorkingHoursIso } from "../../ui";
import { notify } from "../../../lib/feedback";
import { InterviewType } from "../../../lib/types/enums";
import { COMPANY_ADDRESS, OFFICE_HOURS_MESSAGE, OFFICE_HOURS_SHORT } from "../../../lib/business-hours";

/** What is being scheduled: an interview round, or the contract signing appointment. */
export type ScheduleActivity = InterviewType | "CONTRACT_SIGNING";

export interface ScheduleInterviewDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  /** Shown so the recruiter can agree a time with the candidate without leaving the dialog. */
  candidateEmail?: string | null;
  candidateMobile?: string | null;
  type: ScheduleActivity;
  /** True when an existing appointment of this kind is being moved. */
  isReschedule: boolean;
  /** Manila "datetime-local" value to start from. Empty for a new appointment. */
  initialDate?: string;
  /** The schedule being replaced, shown on the calendar. Same format as initialDate. */
  currentDate?: string;
  /** Meeting place or link to start from. Contract signing falls back to the company address. */
  initialLocation?: string;
  onSubmit: (values: { type: ScheduleActivity; scheduledAt: string; location?: string }) => void;
  isSubmitting?: boolean;
}

const LOCATION_MAX = 500;

export const ScheduleInterviewDialog: React.FC<ScheduleInterviewDialogProps> = ({
  open,
  onClose,
  candidateName,
  candidateEmail,
  candidateMobile,
  type,
  isReschedule,
  initialDate = "",
  currentDate,
  initialLocation = "",
  onSubmit,
  isSubmitting = false,
}) => {
  const isContract = type === "CONTRACT_SIGNING";
  const startLocation = initialLocation || (isContract ? COMPANY_ADDRESS : "");
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState(startLocation);

  // Start from the values the caller passes each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setLocation(startLocation);
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isInitial = type === InterviewType.INITIAL_SCREENING;
  const noun = isContract ? "contract signing" : isInitial ? "interview" : "final interview";
  const scheduledAt = date ? dateTimeLocalToManilaIso(date) : "";
  // The first reason Save is off, shown next to the button so a disabled button is never a mystery.
  const blockReason = !date || !scheduledAt
    ? "Choose a date and time."
    : Date.parse(scheduledAt) <= Date.now()
    ? "Choose a time that has not passed."
    : !isWorkingHoursIso(date)
    ? OFFICE_HOURS_MESSAGE
    : isContract && !location.trim()
    ? "Enter where the signing will happen."
    : null;
  const invalid = blockReason !== null;
  const contact = [candidateEmail, candidateMobile].filter(Boolean);

  const handleSave = () => {
    if (!scheduledAt || Date.parse(scheduledAt) <= Date.now()) {
      notify.error("Invalid Date", "Please select a valid future date and time.");
      return;
    }
    if (!isWorkingHoursIso(date)) {
      notify.error("Outside office hours", OFFICE_HOURS_MESSAGE);
      return;
    }
    const place = location.trim();
    if (isContract && !place) return;
    onSubmit({ type, scheduledAt, location: place || undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${isReschedule ? "Reschedule" : "Schedule"} ${noun}`}
      description={
        isReschedule
          ? `Update scheduled date and time for ${candidateName}`
          : `Book ${isContract ? "the contract signing" : `an ${isInitial ? "initial" : "final"} interview`} for ${candidateName}`
      }
    >
      <div className="space-y-4">
        {contact.length > 0 && (
          <p className="text-sm text-slate-700">
            <span className="text-slate-600">Contact: </span>
            {candidateEmail && <span>{candidateEmail}</span>}
            {candidateEmail && candidateMobile && <span className="text-slate-400"> · </span>}
            {candidateMobile && <span className="tabular-nums">{candidateMobile}</span>}
          </p>
        )}
        {!isContract && (
          <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="block font-medium text-slate-600">Interview type</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Calendar className="h-4 w-4 text-navy" aria-hidden="true" />
              <span>{isInitial ? "Initial interview" : "Final interview"}</span>
            </div>
            <p className="text-xs text-slate-600">The 7-day interview deadline starts when this is scheduled.</p>
          </div>
        )}
        <DateTimePicker
          label="Date and time"
          value={date}
          onChange={(val) => setDate(val)}
          minDate={new Date()}
          highlightDate={isReschedule ? currentDate : undefined}
          required
          workingHoursOnly
          helperText={OFFICE_HOURS_SHORT}
        />
        <Input
          label="Location or meeting link"
          placeholder={isContract ? undefined : "e.g. Google Meet link or room number"}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={LOCATION_MAX}
          required={isContract}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          {blockReason && (
            <p className="mr-auto text-sm text-slate-600" role="status">
              {blockReason}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={invalid} loading={isSubmitting} onClick={handleSave}>
            {isReschedule ? "Save new time" : `Schedule ${noun}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
