import React, { useEffect, useState } from "react";
import { Button, Dialog, Input, Select, Textarea } from "../ui";
import { getManilaToday } from "../../lib/field-limits";
import {
  APPLICANT_SELF_REASONS,
  BACKOUT_PARTY_LABELS,
  BACKOUT_REASONS_BY_PARTY,
  BACKOUT_REASON_LABELS,
  partiesForStatus,
  type BackoutParty,
} from "../../lib/backout";

export interface BackoutSubmission {
  party: BackoutParty;
  reason: string;
  notes?: string;
  occurredOn?: string;
}

interface BackoutDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: BackoutSubmission) => void;
  loading?: boolean;
  /** Current application status; limits which parties can be chosen. */
  status: string;
  /** "ta" records any party on someone's behalf; "applicant" is a self-service withdrawal. */
  mode: "ta" | "applicant";
  candidateName?: string;
}

export const BackoutDialog: React.FC<BackoutDialogProps> = ({
  open,
  onClose,
  onSubmit,
  loading,
  status,
  mode,
  candidateName,
}) => {
  const isTa = mode === "ta";
  const today = getManilaToday();
  const [party, setParty] = useState<BackoutParty>("APPLICANT");
  const [reason, setReason] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);
  const [notes, setNotes] = useState("");

  const reasons = isTa ? BACKOUT_REASONS_BY_PARTY[party] : APPLICANT_SELF_REASONS;

  useEffect(() => {
    if (!open) return;
    setParty("APPLICANT");
    setReason("");
    setOccurredOn(getManilaToday());
    setNotes("");
  }, [open]);

  // Switching party can invalidate the chosen reason.
  useEffect(() => {
    if (reason && !reasons.includes(reason)) setReason("");
  }, [reasons, reason]);

  const title = isTa ? "Record backout" : "Withdraw application";
  const description = isTa
    ? `Record who pulled out and why for ${candidateName ?? "this candidate"}. This closes the application.`
    : "Tell us why you are withdrawing. This closes your application and cannot be undone.";

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-4">
        {isTa && (
          <Select
            label="Who pulled out"
            value={party}
            onChange={(e) => setParty(e.target.value as BackoutParty)}
            options={partiesForStatus(status).map((p) => ({ value: p, label: BACKOUT_PARTY_LABELS[p] }))}
          />
        )}
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Select a reason"
          options={reasons.map((r) => ({ value: r, label: BACKOUT_REASON_LABELS[r] ?? r }))}
        />
        {isTa && (
          <Input
            label="Date it happened"
            type="date"
            value={occurredOn}
            max={today}
            onChange={(e) => setOccurredOn(e.target.value)}
          />
        )}
        <Textarea
          label="Notes (optional)"
          placeholder="Add details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
            disabled={!reason || (isTa && !occurredOn)}
            onClick={() =>
              onSubmit({
                party: isTa ? party : "APPLICANT",
                reason,
                notes: notes.trim() || undefined,
                occurredOn: isTa ? occurredOn : undefined,
              })
            }
          >
            {isTa ? "Record backout" : "Withdraw application"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
