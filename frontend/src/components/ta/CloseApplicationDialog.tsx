import React, { useEffect, useState } from "react";
import { Button, Dialog, Input, Select, Textarea } from "../ui";
import { FIELD_LIMITS, getManilaToday } from "../../lib/field-limits";
import {
  BACKOUT_REASONS_BY_PARTY,
  BACKOUT_REASON_LABELS,
  REJECTION_REASON_OPTIONS,
  canKeepInTalentPool,
  type ClosureDisposition,
  type ClosureOutcome,
} from "../../lib/backout";

export interface CloseSubmission {
  outcome: ClosureOutcome;
  reasonCode: string;
  disposition: ClosureDisposition;
  notes: string;
  /** Backed Out only: the day it happened. */
  occurredOn?: string;
}

interface CloseApplicationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CloseSubmission) => void;
  loading?: boolean;
  outcome: ClosureOutcome;
  /** Hiring stage right now; after client review a rejected candidate is kept in the pool by default. */
  stage: string;
  candidateName?: string;
  /** Day the application was created (YYYY-MM-DD, Manila): the earliest allowed Backed Out date. */
  applicationCreatedOn?: string;
}

const KEEP_AFTER_CLIENT_REVIEW = ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW"];

const COPY: Record<ClosureOutcome, { title: string; description: (name: string) => string; submit: string }> = {
  REJECTED: {
    title: "Reject Applicant",
    description: (name) => `${name} does not meet the job or client requirements.`,
    submit: "Reject applicant",
  },
  BACKED_OUT: {
    title: "Mark as Backed Out",
    description: (name) => `${name} withdrew from the hiring process or did not show up.`,
    submit: "Mark as backed out",
  },
};

/** One form for both closures. The outcome only changes the title, the reason list and the date field. */
export const CloseApplicationDialog: React.FC<CloseApplicationDialogProps> = ({
  open,
  onClose,
  onSubmit,
  loading,
  outcome,
  stage,
  candidateName,
  applicationCreatedOn,
}) => {
  const today = getManilaToday();
  // Talent Pool is offered for a rejection only from a stage that may move to it (the backend enforces this for rejections only).
  const poolAllowed = outcome === "BACKED_OUT" || canKeepInTalentPool(stage);
  const defaultDisposition: ClosureDisposition =
    poolAllowed && outcome === "REJECTED" && KEEP_AFTER_CLIENT_REVIEW.includes(stage) ? "TALENT_POOL" : "ARCHIVE";
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<ClosureDisposition>(defaultDisposition);
  const [occurredOn, setOccurredOn] = useState(today);
  const [notes, setNotes] = useState("");

  const isBackout = outcome === "BACKED_OUT";
  const reasonOptions = isBackout
    ? BACKOUT_REASONS_BY_PARTY.APPLICANT.map((r) => ({ value: r, label: BACKOUT_REASON_LABELS[r] ?? r }))
    : REJECTION_REASON_OPTIONS;
  // A no-show is never added to the talent pool, so the only disposition left is Archive.
  const noShow = isBackout && reason === "NO_SHOW";
  // Every closure needs a note explaining the reason.
  const notesMissing = !notes.trim();
  const copy = COPY[outcome];

  useEffect(() => {
    if (!open) return;
    setReason("");
    setDisposition(defaultDisposition);
    setOccurredOn(getManilaToday());
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outcome]);

  return (
    <Dialog open={open} onClose={onClose} title={copy.title} description={copy.description(candidateName ?? "This candidate")}>
      <div className="space-y-4">
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Select a reason"
          options={reasonOptions}
        />
        {isBackout && (
          <Input
            label="Date it happened"
            type="date"
            value={occurredOn}
            min={applicationCreatedOn}
            max={today}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        )}
        {noShow ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No-shows can't be added to the talent pool, so the applicant will be archived.
          </p>
        ) : (
          <Select
            label="What should happen to this applicant"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as ClosureDisposition)}
            options={[
              { value: "ARCHIVE", label: "Archive (no longer considered for active recruitment)" },
              ...(poolAllowed ? [{ value: "TALENT_POOL", label: "Talent Pool (may qualify for future openings)" }] : []),
            ]}
          />
        )}
        <Textarea
          label="Notes"
          placeholder="Add details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          required
          maxLength={FIELD_LIMITS.notes}
          error={notesMissing && reason ? "Add a note explaining the reason." : undefined}
          rows={3}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={loading}
            disabled={!reason || (isBackout && !occurredOn) || notesMissing}
            onClick={() =>
              onSubmit({
                outcome,
                reasonCode: reason,
                disposition: noShow || !poolAllowed ? "ARCHIVE" : disposition,
                notes: notes.trim(),
                occurredOn: isBackout ? occurredOn : undefined,
              })
            }
          >
            {copy.submit}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
