import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { formatDateTime } from "../../lib/utils";
import { TA_COPY } from "../../lib/ta-copy";
import { INTERVIEW_NOTE_PRESETS } from "../../lib/ta-note-presets";
import { QuickNoteChips } from "./QuickNoteChips";

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
  /** Offer a checked-by-default toggle to advance the candidate to the next stage when Passed is saved. */
  canAutoAdvance?: boolean;
  /** Label for the auto-advance checkbox (e.g., "Move candidate to Requirements now"). */
  autoAdvanceLabel?: string;
  onSubmit: (values: { result: InterviewOutcomeResult; notes: string }, options?: { autoAdvance?: boolean }) => void;
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
  canAutoAdvance = false,
  autoAdvanceLabel,
  onSubmit,
  isSubmitting = false,
}) => {
  // No outcome is preselected: pressing Enter on a fresh dialog must never record a pass.
  const [result, setResult] = useState<InterviewOutcomeResult | "">("");
  const [notes, setNotes] = useState(defaultNotes);
  const [showNotesError, setShowNotesError] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Start clean every time the dialog opens, so a reopened dialog never keeps the last outcome.
  useEffect(() => {
    if (open) {
      setResult("");
      setNotes(defaultNotes);
      setShowNotesError(false);
      setAutoAdvance(true);
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

  const showAutoAdvance = Boolean(canAutoAdvance && result === "PASS");
  const notePresets =
    result === "PASS"
      ? isFinalInterview
        ? INTERVIEW_NOTE_PRESETS.FINAL_PASS
        : INTERVIEW_NOTE_PRESETS.INITIAL_PASS
      : result === "FAIL"
        ? INTERVIEW_NOTE_PRESETS.FAIL
        : result === "NO_SHOW"
          ? INTERVIEW_NOTE_PRESETS.NO_SHOW
          : [];

  const handleSave = () => {
    if (!result) return;
    if (!notes.trim()) {
      setShowNotesError(true);
      return;
    }
    if (showAutoAdvance) {
      onSubmit({ result, notes: notes.trim() }, { autoAdvance });
    } else {
      onSubmit({ result, notes: notes.trim() });
    }
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

        {notePresets.length > 0 && (
          <QuickNoteChips presets={notePresets} currentValue={notes} onSelect={setNotes} />
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

        {showAutoAdvance && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 md:min-h-8">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="focus-ring h-4 w-4 rounded border-slate-300 text-navy"
            />
            <span>
              {autoAdvanceLabel ||
                (isFinalInterview
                  ? "Move candidate to Requirements after saving"
                  : "Move candidate to Final interview after saving")}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" loading={isSubmitting} disabled={!result || !notes.trim()} onClick={handleSave}>
            {TA_COPY.interviews.saveOutcome}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
