import React, { useEffect, useState } from "react";
import { Calendar } from "lucide-react";
import { Button, Dialog, Textarea, DateTimePicker, dateTimeLocalToManilaIso, isWorkingHoursIso } from "../../ui";
import { notify } from "../../../lib/feedback";
import { InterviewType } from "../../../lib/types/enums";

export interface ScheduleInterviewDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  type: InterviewType;
  /** True when an open interview of this type is being moved. */
  isReschedule: boolean;
  /** Manila "datetime-local" value to start from. Empty for a new interview. */
  initialDate?: string;
  initialNotes?: string;
  onSubmit: (values: { type: InterviewType; scheduledAt: string; notes?: string }) => void;
  isSubmitting?: boolean;
}

export const ScheduleInterviewDialog: React.FC<ScheduleInterviewDialogProps> = ({
  open,
  onClose,
  candidateName,
  type,
  isReschedule,
  initialDate = "",
  initialNotes = "",
  onSubmit,
  isSubmitting = false,
}) => {
  const [date, setDate] = useState(initialDate);
  const [notes, setNotes] = useState(initialNotes);

  // Start from the values the caller passes each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setNotes(initialNotes);
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isInitial = type === InterviewType.INITIAL_SCREENING;
  const scheduledAt = date ? dateTimeLocalToManilaIso(date) : "";
  const invalid = !date || !scheduledAt || Date.parse(scheduledAt) <= Date.now() || !isWorkingHoursIso(date);

  const handleSave = () => {
    if (!scheduledAt || Date.parse(scheduledAt) <= Date.now()) {
      notify.error("Invalid Date", "Please select a valid future date and time for the interview.");
      return;
    }
    if (!isWorkingHoursIso(date)) {
      notify.error("Outside Working Hours", "Interviews must be scheduled during strictly working hours (9:00 AM to 5:00 PM).");
      return;
    }
    onSubmit({ type, scheduledAt, notes: notes || undefined });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        isInitial
          ? isReschedule ? "Reschedule interview" : "Schedule interview"
          : isReschedule ? "Reschedule final interview" : "Schedule final interview"
      }
      description={
        isReschedule
          ? `Update scheduled date and time for ${candidateName}`
          : `Book an ${isInitial ? "initial" : "final"} interview for ${candidateName}`
      }
    >
      <div className="space-y-4">
        <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="block font-medium text-slate-600">Interview type</span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            <Calendar className="h-4 w-4 text-navy" aria-hidden="true" />
            <span>{isInitial ? "Initial interview" : "Final interview"}</span>
          </div>
          <p className="text-xs text-slate-600">The 7-day interview deadline starts when this is scheduled.</p>
        </div>
        <DateTimePicker
          label="Date and time"
          value={date}
          onChange={(val) => setDate(val)}
          minDate={new Date()}
          required
          workingHoursOnly
          helperText="Interviews must be scheduled during strictly working hours (9:00 AM to 5:00 PM, past dates disabled)."
        />
        <Textarea
          label="Meeting details (optional)"
          placeholder="e.g. Google Meet link or room number"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={invalid} loading={isSubmitting} onClick={handleSave}>
            {isReschedule ? "Save new time" : "Schedule interview"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
