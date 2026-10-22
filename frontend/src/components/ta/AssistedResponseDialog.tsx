import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, Button, Select, Textarea } from "../ui";
import { taApi } from "../../lib/api/ta.api";
import { notify } from "../../lib/feedback";
import { OFFER_DECLINE_REASONS } from "../../lib/types/public.types";

type Decision = "ACCEPT" | "DECLINE";
type Channel = "ASSISTED_PHONE" | "IN_PERSON";

export interface AssistedResponseDialogProps {
  open: boolean;
  onClose: () => void;
  invitationId: number;
  candidateName: string;
  jobTitle: string;
}

const RadioRow: React.FC<{
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}> = ({ name, value, label, checked, onChange }) => (
  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 has-[:checked]:border-navy has-[:checked]:bg-navy-soft">
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-4 accent-[var(--color-navy)]" />
    {label}
  </label>
);

/** Records an offer reply the applicant gave by phone or in person, for people without portal access. */
export const AssistedResponseDialog: React.FC<AssistedResponseDialogProps> = ({
  open,
  onClose,
  invitationId,
  candidateName,
  jobTitle,
}) => {
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState<Decision | "">("");
  const [channel, setChannel] = useState<Channel>("ASSISTED_PHONE");
  const [declineReason, setDeclineReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDecision("");
      setChannel("ASSISTED_PHONE");
      setDeclineReason("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      taApi.recordAssistedResponse(invitationId, {
        decision: decision as Decision,
        channel,
        declineReason: decision === "DECLINE" ? declineReason : undefined,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "talent-pool", "invitations"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      notify.success(
        res.status === "ACCEPTED" ? "Reply recorded: accepted" : "Reply recorded: declined",
        res.status === "ACCEPTED" ? `${candidateName} now has an application for ${jobTitle}.` : `${candidateName} declined ${jobTitle}.`
      );
      onClose();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not record the reply. Try again.");
    },
  });

  const busy = mutation.isPending;

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Record reply"
      description={`${candidateName} replied to the offer for ${jobTitle}.`}
      size="md"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!decision) return setError("Choose Accept or Decline.");
          if (decision === "DECLINE" && !declineReason) return setError("Pick the reason they gave for declining.");
          setError(null);
          mutation.mutate();
        }}
      >
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="text-sm font-medium text-slate-900">Their answer</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioRow name="decision" value="ACCEPT" label="Accept" checked={decision === "ACCEPT"} onChange={() => setDecision("ACCEPT")} />
            <RadioRow name="decision" value="DECLINE" label="Decline" checked={decision === "DECLINE"} onChange={() => setDecision("DECLINE")} />
          </div>
        </fieldset>

        <fieldset className="space-y-2" disabled={busy}>
          <legend className="text-sm font-medium text-slate-900">How did they answer?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <RadioRow name="channel" value="ASSISTED_PHONE" label="Phone call" checked={channel === "ASSISTED_PHONE"} onChange={() => setChannel("ASSISTED_PHONE")} />
            <RadioRow name="channel" value="IN_PERSON" label="In person" checked={channel === "IN_PERSON"} onChange={() => setChannel("IN_PERSON")} />
          </div>
        </fieldset>

        {decision === "DECLINE" && (
          <Select
            label="Reason for declining (required)"
            value={declineReason}
            onChange={(e) => {
              setDeclineReason(e.target.value);
              setError(null);
            }}
            placeholder="Choose a reason"
            options={OFFER_DECLINE_REASONS.map((r) => ({ value: r.value, label: r.label }))}
            disabled={busy}
          />
        )}

        <Textarea
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          disabled={busy}
        />

        {error && (
          <p role="alert" className="text-sm text-rose-600 font-medium">
            {error}
          </p>
        )}

        {(!decision || (decision === "DECLINE" && !declineReason)) && !error && (
          <p className="text-sm text-slate-600">
            {!decision ? "Choose Accept or Decline to save." : "Pick a decline reason to save."}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={busy} disabled={!decision || (decision === "DECLINE" && !declineReason)}>
            Save reply
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
