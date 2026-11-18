import React, { useEffect, useState } from "react";
import { Button, Dialog, Select, Textarea } from "../ui";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { CLIENT_DECISION_PRESETS } from "../../lib/ta-note-presets";
import { QuickNoteChips } from "./QuickNoteChips";

export type BulkClientActionMode = "endorse" | "decision";

export interface BulkClientActionDialogProps {
  mode: BulkClientActionMode | null;
  count: number;
  loading?: boolean;
  onClose: () => void;
  onEndorse: (notes?: string) => void;
  onDecision: (values: { outcome: "APPROVED" | "DECLINED"; notes: string }) => void;
}

const candidateCount = (count: number) => (count === 1 ? "1 candidate" : `${count} candidates`);

/** Bulk client review dialog: either send screened candidates to clients or record client decisions. */
export const BulkClientActionDialog: React.FC<BulkClientActionDialogProps> = ({
  mode,
  count,
  loading = false,
  onClose,
  onEndorse,
  onDecision,
}) => {
  const [outcome, setOutcome] = useState<"" | "APPROVED" | "DECLINED">("");
  const [notes, setNotes] = useState("");
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!mode) return;
    setOutcome("");
    setNotes("");
    setShowError(false);
  }, [mode]);

  if (!mode) return null;

  const isEndorse = mode === "endorse";
  const presets = !isEndorse && outcome ? CLIENT_DECISION_PRESETS[outcome] : [];

  const handleSubmit = () => {
    if (isEndorse) {
      const trimmed = notes.trim();
      onEndorse(trimmed || undefined);
      return;
    }
    if (!outcome) return;
    if (!notes.trim()) {
      setShowError(true);
      return;
    }
    onDecision({ outcome, notes: notes.trim() });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEndorse ? "Send candidates to client" : "Record client decision"}
      description={
        isEndorse
          ? `${candidateCount(count)} will be sent to the client for review.`
          : `Save the client's decision for ${candidateCount(count)}.`
      }
    >
      <div className="space-y-4">
        {isEndorse ? (
          <Textarea
            label="Notes for the client (optional)"
            helperText="Leave blank to generate each candidate's match score and screening summary automatically."
            placeholder="Add shared notes for the client, or leave blank for automatic summaries."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={FIELD_LIMITS.notes}
            rows={3}
          />
        ) : (
          <>
            <Select
              label="Client outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as "" | "APPROVED" | "DECLINED")}
              options={[
                { value: "", label: "Choose the client's decision" },
                { value: "APPROVED", label: "Approved by client" },
                { value: "DECLINED", label: "Declined by client" },
              ]}
            />
            {presets.length > 0 && (
              <QuickNoteChips presets={presets} currentValue={notes} onSelect={setNotes} />
            )}
            <Textarea
              label="Client decision note"
              placeholder="Record client feedback or decision details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={showError && !notes.trim() ? "Add a note about the client's decision." : undefined}
              maxLength={FIELD_LIMITS.notes}
              required
              rows={3}
            />
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={!isEndorse && outcome === "DECLINED" ? "danger" : "primary"}
            size="sm"
            loading={loading}
            disabled={!isEndorse && (!outcome || !notes.trim())}
            onClick={handleSubmit}
          >
            {isEndorse ? `Send ${count} to client` : "Save client decision"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
