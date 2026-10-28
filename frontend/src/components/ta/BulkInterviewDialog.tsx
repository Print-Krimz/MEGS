import React, { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "../ui";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { interviewOutcomeNextStep } from "./InterviewOutcomeDialog";

export type BulkInterviewAction = "PASS" | "NO_SHOW";

interface BulkInterviewDialogProps {
  action: BulkInterviewAction | null;
  count: number;
  isFinalInterview: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
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

  useEffect(() => {
    if (action) {
      setNotes("");
      setShowError(false);
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
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={noShow ? "danger" : "primary"}
            size="sm"
            loading={loading}
            onClick={() => {
              if (!notes.trim()) {
                setShowError(true);
                return;
              }
              onSubmit(notes.trim());
            }}
          >
            {noShow ? `Mark ${count} as no show` : `Mark ${count} as passed`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
