import React, { useState, useEffect } from "react";
import { Dialog, Button, Textarea, Select, ComboBox } from "../ui";
import { Send, Briefcase } from "lucide-react";
import { TalentPoolCandidate } from "../../lib/types/ta.types";

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

  useEffect(() => {
    if (open) {
      setSelectedJobId(initialTargetJobId || jobs[0]?.id || 0);
      setMessage(
        candidate
          ? `Hi ${candidate.firstName}, your background and skills match our opening for ${targetJobTitle || "this position"}. We invite you to apply!`
          : ""
      );
      setExpiresInDays(7);
      setJobError(null);
    }
  }, [open, initialTargetJobId, targetJobTitle, candidate, jobs]);

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
      title="Invite candidate to apply"
      description={`Send an invitation to ${candidate.firstName} ${candidate.lastName}.`}
      overflowVisible
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Candidate Profile Summary */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800">
              {candidate.firstName} {candidate.lastName}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {candidate.availability}
            </span>
          </div>
          <div className="text-slate-500 font-mono">{candidate.email}</div>
          {candidate.currentRole && (
            <div className="text-slate-600">Current role: {candidate.currentRole}</div>
          )}
        </div>

        {/* Target Job Selection */}
        {initialTargetJobId ? (
          <div className="text-xs">
            <label className="block text-slate-600 font-medium mb-1">Job opening</label>
            <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 font-semibold flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>#{initialTargetJobId} — {targetJobTitle}</span>
            </div>
          </div>
        ) : (
          <ComboBox
            label="Job opening"
            placeholder="Search target job opening..."
            value={selectedJobId ? String(selectedJobId) : ""}
            error={jobError || undefined}
            onChange={(val) => {
              setSelectedJobId(Number(val) || 0);
              if (jobError) setJobError(null);
            }}
            options={jobs.map((j) => ({
              value: String(j.id),
              label: j.title,
              subtitle: `Job opening #${j.id} • ${j.location || "Philippines"}`,
              badge: j.status,
            }))}
            emptyText="No open job openings found"
            required
          />
        )}

        {/* Invitation Message */}
        <Textarea
          label="Message to the candidate (optional)"
          placeholder="Explain why this opening may be a good fit..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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
          <Button
            variant="primary"
            size="sm"
            type="submit"
            loading={loading}
            leftIcon={<Send className="w-3.5 h-3.5" />}
          >
            Send invitation
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
