import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Input, Select, Textarea } from "../ui";
import { employeesApi } from "../../lib/api/employees.api";
import { getManilaToday } from "../../lib/field-limits";
import { notify } from "../../lib/feedback";

type Disposition = "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED";

const DISPOSITION_HELP: Record<Disposition, string> = {
  AVAILABLE_FOR_REDEPLOYMENT: "Appears in the Redeployment queue.",
  NOT_CONFIRMED: "Stays out of the Redeployment queue until you update the employee record.",
  SEPARATED: "Marked as separated from the agency.",
};

const DISPOSITION_RESULT: Record<Disposition, string> = {
  AVAILABLE_FOR_REDEPLOYMENT: "Moved to the Redeployment queue.",
  NOT_CONFIRMED: "Kept out of the Redeployment queue.",
  SEPARATED: "Marked as separated.",
};

export const EndAssignmentDialog: React.FC<{ open: boolean; deploymentId: string | number; employeeName: string; onClose: () => void }> = ({ open, deploymentId, employeeName, onClose }) => {
  const cache = useQueryClient();
  const [actualEnd, setActualEnd] = useState(getManilaToday());
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<Disposition | "">("");

  useEffect(() => {
    if (!open) return;
    setActualEnd(getManilaToday());
    setReason("");
    setDisposition("");
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!disposition) throw new Error("Choose what happens next.");
      return employeesApi.endEmployeeDeployment(deploymentId, { actualEnd, reason: reason.trim(), disposition });
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["ta"] });
      void cache.invalidateQueries({ queryKey: ["employees"] });
      void cache.invalidateQueries({ queryKey: ["ta", "redeployment-queue"] });
      onClose();
      notify.success("Assignment ended", disposition ? DISPOSITION_RESULT[disposition] : undefined);
    },
    onError: (error) => notify.error("Unable to end assignment", error),
  });

  const missing = !actualEnd ? "Enter the last working date." : !reason.trim() ? "Add a reason." : !disposition ? "Choose what happens next." : "";

  return <Dialog open={open} onClose={onClose} title="End assignment" description={`Record the last working date and next step for ${employeeName}.`}>
    <div className="space-y-4">
      <Input label="Actual last working date" type="date" value={actualEnd} max={getManilaToday()} onChange={(event) => setActualEnd(event.target.value)} required />
      <div className="space-y-1">
        <Select label="Worker’s next step" value={disposition} onChange={(event) => setDisposition(event.target.value as Disposition | "")} options={[
          { value: "", label: "Choose what happens next" },
          { value: "AVAILABLE_FOR_REDEPLOYMENT", label: "Wants another assignment" }, { value: "NOT_CONFIRMED", label: "Not confirmed yet" }, { value: "SEPARATED", label: "Leaving the agency" },
        ]} />
        {disposition && <p className="text-xs text-slate-500">{DISPOSITION_HELP[disposition]}</p>}
      </div>
      <Textarea label="Reason for ending this assignment" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="For example: client assignment ended or worker requested a transfer" />
      <div className="flex items-center justify-end gap-2">
        {missing && <span className="text-xs text-slate-500">{missing}</span>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={Boolean(missing)} loading={mutation.isPending} onClick={() => mutation.mutate()}>End assignment</Button>
      </div>
    </div>
  </Dialog>;
};
