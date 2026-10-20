import React, { useState, useEffect } from "react";
import { Dialog, Button, Textarea, Select, ComboBox } from "../ui";
import { TalentPoolCandidate } from "../../lib/types/ta.types";
import { TA_COPY } from "../../lib/ta-copy";
import { AvailabilityText } from "./PoolCandidateCard";

export interface SendInvitationModalProps {
  open: boolean;
  onClose: () => void;
  candidate: TalentPoolCandidate | null;
  targetJobId?: number;
  targetJobTitle?: string;
  jobs?: Array<{ id: number; title: string; location?: string | null; status: string }>;
  onSend: (payload: {
    applicantProfileId: number;
    targetJobId: number;
    message?: string;
    expiresInDays: number;
  }) => void;
  loading?: boolean;
}

export const SendInvitationModal: React.FC<SendInvitationModalProps> = ({
  open,
  onClose,
  candidate,
  targetJobId: initialTargetJobId,
  targetJobTitle,
  jobs = [],
  onSend,
  loading = false,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<number>(initialTargetJobId || 0);
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [jobError, setJobError] = useState<string | null>(null);
  const [messageEdited, setMessageEdited] = useState(false);

  const draftMessage = (jobTitle?: string) =>
    candidate
      ? `Hi ${candidate.firstName}, your background and skills match our opening for ${jobTitle || "this position"}. We invite you to apply!`
      : "";

  // The job is never guessed: with no job passed in, the field starts empty and the TA must pick one.
  useEffect(() => {
    if (open) {
      setSelectedJobId(initialTargetJobId || 0);
      setMessage(draftMessage(targetJobTitle));
      setMessageEdited(false);
      setExpiresInDays(7);
      setJobError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTargetJobId, targetJobTitle, candidate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;
    const finalJobId = initialTargetJobId || selectedJobId;
    if (!finalJobId || finalJobId <= 0) {
      setJobError("Choose a job opening for this invitation.");
      return;
    }
    setJobError(null);

    onSend({
      applicantProfileId: candidate.applicantProfileId,
      targetJobId: finalJobId,
      message: message.trim() || undefined,
      expiresInDays,
    });
  };

  if (!candidate) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TA_COPY.invitations.inviteToApply}
      description={`Send an invitation to ${candidate.firstName} ${candidate.lastName}.`}
      overflowVisible
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1 border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">
              {candidate.firstName} {candidate.lastName}
            </span>
            <AvailabilityText availability={candidate.availability} />
          </div>
          <div className="break-all text-slate-600">{candidate.email}</div>
          {candidate.currentRole && <div className="text-slate-700">Current role: {candidate.currentRole}</div>}
        </div>

        {initialTargetJobId ? (
          <div className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Job opening</span>
            <div className="border border-navy-line bg-navy-soft p-2.5 font-semibold text-navy">
              {targetJobTitle || `Job opening #${initialTargetJobId}`}
            </div>
          </div>
        ) : (
          <ComboBox
            label="Job opening"
            placeholder="Search job openings"
            value={selectedJobId ? String(selectedJobId) : ""}
            error={jobError || undefined}
            onChange={(val) => {
              const id = Number(val) || 0;
              setSelectedJobId(id);
              if (!messageEdited) setMessage(draftMessage(jobs.find((j) => j.id === id)?.title));
              if (jobError) setJobError(null);
            }}
            options={jobs.map((j) => ({
              value: String(j.id),
              label: j.title,
              subtitle: j.location || "Philippines",
              badge: j.status ? j.status.charAt(0) + j.status.slice(1).toLowerCase() : undefined,
            }))}
            emptyText="No job openings found"
            required
          />
        )}

        {/* Invitation Message */}
        <Textarea
          label="Message to the candidate (optional)"
          placeholder="Explain why this opening may be a good fit..."
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setMessageEdited(true);
          }}
          rows={3}
        />

        {/* Expiration Duration */}
        <Select
          label="Invitation expires after"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value))}
          options={[
            { value: 3, label: "3 days" },
            { value: 7, label: "7 days (standard)" },
            { value: 14, label: "14 days" },
            { value: 30, label: "30 days" },
          ]}
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading}>
            {TA_COPY.workforce.actions.sendInvitation}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
