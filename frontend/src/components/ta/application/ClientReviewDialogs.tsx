import React, { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button, ComboBox, Dialog, Select, Textarea } from "../../ui";

type ClientOption = { id: number; name: string; industry?: string | null; address?: string | null };

export interface SendToClientDialogProps {
  open: boolean;
  onClose: () => void;
  /**
   * send: the first presentation to the client (a later step records the answer).
   * record: write down a decision that was never entered, so the outcome is chosen here.
   */
  mode: "send" | "record";
  candidateName: string;
  linkedClientId: number;
  linkedClientName: string;
  jobTitle?: string | null;
  requestTitle?: string | null;
  clients: ClientOption[];
  /** Client to start with when the opening has no linked client. */
  initialClientId?: number | null;
  onSubmit: (values: { clientId: number; outcome: "PENDING" | "APPROVED" | "DECLINED"; notes?: string }) => void;
  isSubmitting?: boolean;
}

export const SendToClientDialog: React.FC<SendToClientDialogProps> = ({
  open,
  onClose,
  mode,
  candidateName,
  linkedClientId,
  linkedClientName,
  jobTitle,
  requestTitle,
  clients,
  initialClientId = null,
  onSubmit,
  isSubmitting = false,
}) => {
  const [manualClientId, setManualClientId] = useState<number | null>(initialClientId);
  const [outcome, setOutcome] = useState<"" | "PENDING" | "APPROVED" | "DECLINED">(mode === "send" ? "PENDING" : "");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setManualClientId(initialClientId);
    setOutcome(mode === "send" ? "PENDING" : "");
    setNotes("");
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const targetClientId = linkedClientId || manualClientId;
  const isSend = mode === "send";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isSend ? "Send candidate to client" : "Record client decision"}
      description={isSend ? `Share ${candidateName} with the client for review.` : `Save the client's decision on ${candidateName}.`}
      overflowVisible
    >
      <div className="space-y-4">
        {linkedClientId ? (
          <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="block text-xs text-slate-600">Client (linked from manpower request)</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-navy" aria-hidden="true" />
              <span>{linkedClientName}</span>
            </div>
            <div className="text-xs text-slate-600">
              Position: {jobTitle || "Specialist"}
              {requestTitle ? ` • Request: ${requestTitle}` : ""}
            </div>
          </div>
        ) : (
          <ComboBox
            label="Client"
            placeholder="Search verified corporate client..."
            leftIcon={<Building2 className="h-3.5 w-3.5 text-slate-500" />}
            value={manualClientId ? String(manualClientId) : ""}
            onChange={(val) => setManualClientId(Number(val) || null)}
            options={clients.map((c) => ({
              value: String(c.id),
              label: c.name,
              subtitle: `${c.industry || "General"} • ${c.address || "Philippines"}`,
            }))}
            helperText="This opening is not linked to a manpower request, so choose the client manually."
            required
          />
        )}

        {!isSend && (
          <Select
            label="Client decision"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
            options={[
              { value: "", label: "Choose the client's decision" },
              { value: "PENDING", label: "Waiting for client review" },
              { value: "APPROVED", label: "Approved by client" },
              { value: "DECLINED", label: "Declined by client" },
            ]}
          />
        )}
        <Textarea
          label={isSend ? "Notes for the client" : "Client notes"}
          placeholder={
            isSend
              ? "Summarize strengths, interview findings, or other useful context."
              : "Record client feedback, salary details, or interview notes."
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!targetClientId || !outcome}
            loading={isSubmitting}
            onClick={() => {
              if (!targetClientId || !outcome) return;
              onSubmit({ clientId: targetClientId, outcome, notes: notes || undefined });
            }}
          >
            {isSend ? "Send to client" : "Save client decision"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export interface ClientDecisionDialogProps {
  open: boolean;
  onClose: () => void;
  clientName: string;
  jobTitle?: string | null;
  requestTitle?: string | null;
  /** The note sent with the candidate. Shown as context, never copied into the decision note. */
  priorNote?: { notes: string; date: string } | null;
  initialOutcome: "" | "PENDING" | "APPROVED" | "DECLINED";
  initialNotes: string;
  onSubmit: (values: { outcome: "PENDING" | "APPROVED" | "DECLINED"; notes?: string }) => void;
  isSubmitting?: boolean;
}

export const ClientDecisionDialog: React.FC<ClientDecisionDialogProps> = ({
  open,
  onClose,
  clientName,
  jobTitle,
  requestTitle,
  priorNote,
  initialOutcome,
  initialNotes,
  onSubmit,
  isSubmitting = false,
}) => {
  const [outcome, setOutcome] = useState(initialOutcome);
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (!open) return;
    setOutcome(initialOutcome);
    setNotes(initialNotes);
    // Only reopening resets the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Record client decision" description={`Save the decision from ${clientName}.`}>
      <div className="space-y-4">
        <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <span className="block text-xs text-slate-600">Client and job opening</span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
            <Building2 className="h-4 w-4 text-navy" aria-hidden="true" />
            <span>{clientName}</span>
          </div>
          <div className="text-xs text-slate-600">
            Position: {jobTitle || "Specialist"}
            {requestTitle ? ` • MRF: ${requestTitle}` : ""}
          </div>
        </div>

        {priorNote && (
          <p className="text-xs text-slate-600">
            {/^sent to client/i.test(priorNote.notes) ? priorNote.notes : `Sent to client${priorNote.date ? ` on ${priorNote.date}` : ""}: ${priorNote.notes}`}
          </p>
        )}

        <Select
          label="Client outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          options={[
            { value: "", label: "Choose the client's decision" },
            { value: "PENDING", label: "Waiting for client review" },
            { value: "APPROVED", label: "Approved by client" },
            { value: "DECLINED", label: "Declined by client" },
          ]}
        />
        <Textarea
          label="Client decision note"
          placeholder="Record client feedback, salary details, or interview notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={outcome === "DECLINED" ? "danger" : "primary"}
            size="sm"
            loading={isSubmitting}
            disabled={!outcome}
            onClick={() => {
              if (outcome) onSubmit({ outcome, notes: notes || undefined });
            }}
          >
            Save client decision
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
