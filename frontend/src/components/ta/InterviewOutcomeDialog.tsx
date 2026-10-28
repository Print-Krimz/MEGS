import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { formatDateTime } from "../../lib/utils";
import { TA_COPY } from "../../lib/ta-copy";

export type InterviewOutcomeResult = "PASS" | "FAIL" | "NO_SHOW";

/** One line that says what happens next. Reuse it in success toasts so the wording stays identical. */
export const interviewOutcomeNextStep = (result: InterviewOutcomeResult, isFinalInterview: boolean): string => {
  if (result === "PASS") {
    return isFinalInterview
      ? "Next: move the candidate to requirements."
      : "Next: send the candidate to the client, or skip to final interview.";
  }
  if (result === "FAIL") return "The candidate stays at this stage until you close the application.";
  return "The application will be closed as backed out and archived.";
};

/** Past-tense result word for toasts: "passed", "not passed", "no show". */
export const interviewOutcomeWord = (result: InterviewOutcomeResult): string =>
  result === "PASS" ? "passed" : result === "FAIL" ? "not passed" : "no show";

export interface InterviewOutcomeDialogProps {
  open: boolean;
  onClose: () => void;
  candidateName: string;
  jobTitle?: string | null;
  isFinalInterview: boolean;
  scheduledAt?: string | null;
  defaultNotes?: string;
  onSubmit: (values: { result: InterviewOutcomeResult; notes: string }) => void;
  isSubmitting?: boolean;
}

export const InterviewOutcomeDialog: React.FC<InterviewOutcomeDialogProps> = ({
  open,
  onClose,
  candidateName,
  jobTitle,
  isFinalInterview,
  scheduledAt,
  defaultNotes = "",
  onSubmit,
  isSubmitting = false,
}) => {
  // No outcome is preselected: pressing Enter on a fresh dialog must never record a pass.
  const [result, setResult] = useState<InterviewOutcomeResult | "">("");
  const [notes, setNotes] = useState(defaultNotes);
  const [showNotesError, setShowNotesError] = useState(false);

  // Start clean every time the dialog opens, so a reopened dialog never keeps the last outcome.
  useEffect(() => {
    if (open) {
      setResult("");
      setNotes(defaultNotes);
      setShowNotesError(false);
    }
    // defaultNotes is read only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const stageLabel = isFinalInterview ? "Final interview" : "Initial screening";
  const notesError = showNotesError && !notes.trim()
    ? result === "FAIL"
      ? "Add a note explaining why the candidate did not pass."
      : "Add a note about this interview."
    : undefined;

  const choose = { value: "", label: "Choose an outcome" };
  const options = isFinalInterview
    ? [
        choose,
        { value: "PASS", label: "Passed — client approved" },
        { value: "FAIL", label: "Not passed — client declined" },
        { value: "NO_SHOW", label: "No show" },
      ]
    : [
        choose,
        { value: "PASS", label: "Passed" },
        { value: "FAIL", label: "Not passed" },
        { value: "NO_SHOW", label: "No show" },
      ];

  const handleSave = () => {
    if (!result) return;
    if (!notes.trim()) {
      setShowNotesError(true);
      return;
    }
    onSubmit({ result, notes: notes.trim() });
  };

  return (
    <Dialog open={open} onClose={onClose} title={TA_COPY.interviews.recordOutcome}>
      <div className="space-y-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
          <dt className="text-slate-600">Candidate</dt>
          <dd className="font-medium text-slate-900">{candidateName}</dd>
          {jobTitle ? (
            <>
              <dt className="text-slate-600">Job</dt>
              <dd className="text-slate-900">{jobTitle}</dd>
            </>
          ) : null}
          <dt className="text-slate-600">Stage</dt>
          <dd className="text-slate-900">{stageLabel}</dd>
          {scheduledAt ? (
            <>
              <dt className="text-slate-600">Scheduled</dt>
              <dd className="text-slate-900">{formatDateTime(scheduledAt)}</dd>
            </>
          ) : null}
        </dl>

        <Select
          label={isFinalInterview ? "Client outcome" : "Outcome"}
          value={result}
          onChange={(e) => setResult(e.target.value as InterviewOutcomeResult | "")}
          options={options}
        />
        {result && (
          <p className="text-sm text-slate-600" data-testid="outcome-next-step">
            {interviewOutcomeNextStep(result, isFinalInterview)}
          </p>
        )}

        <Textarea
          label={isFinalInterview ? "Client notes" : "Interview notes"}
          placeholder={
            isFinalInterview
              ? "Record client feedback, agreed salary, or other notes."
              : "Record strengths, concerns, and recommended next steps."
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          error={notesError}
          required
          rows={3}
        />

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSubmitting} disabled={!result} onClick={handleSave}>
            {TA_COPY.interviews.saveOutcome}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
