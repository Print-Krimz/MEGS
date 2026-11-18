import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { taApi } from "../../lib/api/ta.api";
import { addManilaCalendarDays, getManilaToday } from "../../lib/field-limits";
import { notify } from "../../lib/feedback";
import { DOC_UPDATE_REASON_PRESETS } from "../../lib/ta-note-presets";
import { QuickNoteChips } from "./QuickNoteChips";

export const DocumentUpdateRequestDialog: React.FC<{ target: { id: number; label: string }; onClose: () => void }> = ({ target, onClose }) => {
  const cache = useQueryClient();
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState(() => addManilaCalendarDays(getManilaToday(), 7));
  const mutation = useMutation({
    mutationFn: () => taApi.requestDocumentUpdate(target.id, { reason: reason.trim(), deadline }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["ta"] }); onClose(); notify.success("Update requested", "The applicant received the reason and deadline in My Documents."); },
    onError: (error) => notify.error("Unable to request an update", error),
  });
  return <Dialog open onClose={onClose} title="Request updated document" description={target.label}>
    <div className="space-y-4">
      <QuickNoteChips presets={DOC_UPDATE_REASON_PRESETS} currentValue={reason} onSelect={setReason} />
      <Textarea label="What needs updating?" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="Explain the expiry, missing information, or correction needed." />
      <DateField label="Submission deadline" value={deadline} min={getManilaToday()} onChange={(event) => setDeadline(event.target.value)} required />
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3"><Button variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button variant="primary" size="sm" disabled={!reason.trim() || !deadline || deadline < getManilaToday()} loading={mutation.isPending} onClick={() => mutation.mutate()}>Send request</Button></div>
    </div>
  </Dialog>;
};
