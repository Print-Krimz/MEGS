import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Textarea } from "../ui";
import { taApi } from "../../lib/api/ta.api";
import { getManilaToday } from "../../lib/field-limits";
import { notify } from "../../lib/feedback";

export const DocumentUpdateRequestDialog: React.FC<{ target: { id: number; label: string }; onClose: () => void }> = ({ target, onClose }) => {
  const cache = useQueryClient();
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const mutation = useMutation({
    mutationFn: () => taApi.requestDocumentUpdate(target.id, { reason: reason.trim(), deadline }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["ta"] }); onClose(); notify.success("Update requested", "The applicant received the reason and deadline in My Documents."); },
    onError: (error) => notify.error("Unable to request an update", error),
  });
  return <Dialog open onClose={onClose} title="Request updated document" description={target.label}>
    <div className="space-y-4">
      <Textarea label="What needs updating?" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Explain the expiry, missing information, or correction needed." />
      <Input label="Submission deadline" type="date" value={deadline} min={getManilaToday()} onChange={(event) => setDeadline(event.target.value)} required />
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!reason.trim() || !deadline || deadline < getManilaToday()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Send request</Button></div>
    </div>
  </Dialog>;
};
