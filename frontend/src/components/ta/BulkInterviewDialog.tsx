import React, { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "../ui";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { INTERVIEW_NOTE_PRESETS } from "../../lib/ta-note-presets";
import { interviewOutcomeNextStep } from "./InterviewOutcomeDialog";
import { QuickNoteChips } from "./QuickNoteChips";

export type BulkInterviewAction = "PASS" | "NO_SHOW";

interface BulkInterviewDialogProps {
  action: BulkInterviewAction | null;
  count: number;
  isFinalInterview: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (notes: string, options?: { autoAdvance?: boolean }) => void;
}

const plural = (count: number) => (count === 1 ? "1 interview" : `${count} interviews`);

export const bulkInterviewTitle = (action: BulkInterviewAction, isFinalInterview: boolean) =>
  action === "NO_SHOW" ? "Mark as no show" : isFinalInterview ? "Mark as passed (client approved)" : "Mark as passed";

/** Record one outcome for many interviews. Not passed needs a note per candidate, so it is not offered here. */
export const BulkInterviewDialog: React.FC<BulkInterviewDialogProps> = ({
  action,
  count,
  isFinalInterview,
  loading,
  onClose,
  onSubmit,
}) => {
  const [notes, setNotes] = useState("");
  const [showError, setShowError] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  useEffect(() => {
    if (action) {
      setNotes("");
      setShowError(false);
      setAutoAdvance(true);
    }
  }, [action]);

  if (!action) return null;
  const noShow = action === "NO_SHOW";

  return (
    <Dialog
      open
      onClose={onClose}
      title={bulkInterviewTitle(action, isFinalInterview)}
      description={
        noShow
          ? `${plural(count)} will be recorded as no show. Each application is closed as backed out and archived, and the applicant is marked as a no-show. This cannot be undone.`
          : `${plural(count)} will be recorded as passed. Each applicant is notified. ${interviewOutcomeNextStep("PASS", isFinalInterview)}`
      }
    >
      <div className="space-y-4">
        <QuickNoteChips
          presets={
            noShow
              ? INTERVIEW_NOTE_PRESETS.NO_SHOW
              : isFinalInterview
                ? INTERVIEW_NOTE_PRESETS.FINAL_PASS
                : INTERVIEW_NOTE_PRESETS.INITIAL_PASS
          }
          currentValue={notes}
          onSelect={setNotes}
        />
        <Textarea
          label="Notes"
          required
          error={showError && !notes.trim() ? "Add a note for these interviews." : undefined}
          placeholder={noShow ? "Added to every selected interview." : "Added to every selected interview, for example a shared remark."}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={FIELD_LIMITS.notes}
          rows={3}
        />
        {!noShow && (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700 md:min-h-8">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="focus-ring h-4 w-4 rounded border-slate-300 text-navy"
            />
            <span>
              {isFinalInterview
                ? "Move passed candidates to Requirements after saving"
                : "Send passed candidates to client review (or Final interview when client review is not required)"}
            </span>
          </label>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={noShow ? "danger" : "primary"}
            size="sm"
            loading={loading}
            disabled={!notes.trim()}
            onClick={() => {
              if (!notes.trim()) {
                setShowError(true);
                return;
              }
              if (noShow) {
                onSubmit(notes.trim());
              } else {
                onSubmit(notes.trim(), { autoAdvance });
              }
            }}
          >
            {noShow ? `Mark ${count} as no show` : `Mark ${count} as passed`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
