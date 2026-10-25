import React, { useEffect, useState } from "react";
import { Button, ComboBox, Dialog, Select, Textarea } from "../ui";

interface JobOption {
  id: number;
  title: string;
  location?: string | null;
  status?: string;
}

interface BulkInviteDialogProps {
  open: boolean;
  onClose: () => void;
  count: number;
  /** The job is already decided (the opening's own pool tab, or a job chosen on the Candidate pool page). */
  fixedJob?: { id: number; title?: string };
  /** Otherwise the recruiter picks one of these. */
  jobs?: JobOption[];
  /** One message goes to everyone, so it cannot use a single candidate's name. */
  draftMessage: (jobTitle?: string) => string;
  loading?: boolean;
  onSubmit: (payload: { targetJobId: number; message?: string; expiresInDays: number }) => void;
}

/** Invite several candidates to one job with one message. */
export const BulkInviteDialog: React.FC<BulkInviteDialogProps> = ({
  open,
  onClose,
  count,
  fixedJob,
  jobs = [],
  draftMessage,
  loading = false,
  onSubmit,
}) => {
  const [jobId, setJobId] = useState(0);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(7);

  useEffect(() => {
    if (!open) return;
    setJobId(fixedJob?.id ?? 0);
    setMessage(draftMessage(fixedJob?.title));
    setMessageEdited(false);
    setExpiresInDays(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedJob?.id, fixedJob?.title]);

  const targetJobId = fixedJob?.id ?? jobId;
  const noun = count === 1 ? "candidate" : "candidates";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Invite to apply"
      description={`The same invitation goes to ${count} ${noun}. Each one is notified in the app and by email. Candidates who cannot be invited are listed afterward.`}
      overflowVisible
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!targetJobId) return;
          onSubmit({ targetJobId, message: message.trim() || undefined, expiresInDays });
        }}
      >
        {fixedJob ? (
          <div className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-slate-700">Job opening</span>
            <div className="border border-navy-line bg-navy-soft p-2.5 font-semibold text-navy">
              {fixedJob.title || `Job opening #${fixedJob.id}`}
            </div>
          </div>
        ) : (
          <ComboBox
            label="Job opening"
            placeholder="Search job openings"
            value={jobId ? String(jobId) : ""}
            onChange={(value) => {
              const id = Number(value) || 0;
              setJobId(id);
              if (!messageEdited) setMessage(draftMessage(jobs.find((job) => job.id === id)?.title));
            }}
            options={jobs.map((job) => ({
              value: String(job.id),
              label: job.title,
              subtitle: job.location || "Philippines",
              badge: job.status ? job.status.charAt(0) + job.status.slice(1).toLowerCase() : undefined,
            }))}
            emptyText="No job openings found"
            required
          />
        )}
        <Textarea
          label="Message to the candidates (optional)"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setMessageEdited(true);
          }}
          rows={4}
          maxLength={1000}
        />
        <Select
          label="Invitation expires after"
          value={expiresInDays}
          onChange={(event) => setExpiresInDays(Number(event.target.value))}
          options={[
            { value: 3, label: "3 days" },
            { value: 7, label: "7 days (standard)" },
            { value: 14, label: "14 days" },
            { value: 30, label: "30 days" },
          ]}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={loading} disabled={!targetJobId}>
            {`Send ${count} ${count === 1 ? "invitation" : "invitations"}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
