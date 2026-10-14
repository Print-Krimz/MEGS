import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Select, Textarea } from "../ui";
import { employeesApi } from "../../lib/api/employees.api";
import { getManilaToday } from "../../lib/field-limits";
import { notify } from "../../lib/feedback";

export const EndAssignmentDialog: React.FC<{ open: boolean; deploymentId: string | number; employeeName: string; onClose: () => void }> = ({ open, deploymentId, employeeName, onClose }) => {
  const cache = useQueryClient();
  const [actualEnd, setActualEnd] = useState(getManilaToday());
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<"AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED">("NOT_CONFIRMED");
  const mutation = useMutation({
    mutationFn: () => employeesApi.endEmployeeDeployment(deploymentId, { actualEnd, reason: reason.trim(), disposition }),
    onSuccess: () => { void cache.invalidateQueries({ queryKey: ["ta"] }); onClose(); notify.success("Assignment ended", "The last working date and next step have been recorded."); },
    onError: (error) => notify.error("Unable to end assignment", error),
  });
  return <Dialog open={open} onClose={onClose} title="End assignment" description={`Record the actual last working day and next step for ${employeeName}.`}>
    <div className="space-y-4">
      <Input label="Actual last working date" type="date" value={actualEnd} max={getManilaToday()} onChange={(event) => setActualEnd(event.target.value)} required />
      <Select label="Worker’s next step" value={disposition} onChange={(event) => setDisposition(event.target.value as typeof disposition)} options={[
        { value: "AVAILABLE_FOR_REDEPLOYMENT", label: "Wants another assignment" }, { value: "NOT_CONFIRMED", label: "Not confirmed yet" }, { value: "SEPARATED", label: "Leaving the agency" },
      ]} />
      <Textarea label="Reason for ending this assignment" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required />
      <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" disabled={!actualEnd || !reason.trim()} loading={mutation.isPending} onClick={() => mutation.mutate()}>End assignment</Button></div>
    </div>
  </Dialog>;
};
