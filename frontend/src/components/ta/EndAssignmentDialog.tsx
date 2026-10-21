import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Dialog, Select, Textarea } from "../ui";
import { DateField } from "../common/DateField";
import { employeesApi } from "../../lib/api/employees.api";
import { getManilaToday, toManilaDateInput } from "../../lib/field-limits";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { formatDate } from "../../lib/utils";

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

export const EndAssignmentDialog: React.FC<{
  open: boolean;
  deploymentId: string | number;
  employeeName: string;
  /** Recorded first working date. The last working date cannot be earlier. */
  actualStart?: string | null;
  onClose: () => void;
}> = ({ open, deploymentId, employeeName, actualStart, onClose }) => {
  const earliestEnd = toManilaDateInput(actualStart);
  const startsLater = Boolean(earliestEnd) && earliestEnd > getManilaToday();
  const cache = useQueryClient();
  const navigate = useNavigate();
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
      const description = disposition ? DISPOSITION_RESULT[disposition] : undefined;
      if (disposition === "AVAILABLE_FOR_REDEPLOYMENT") {
        // notify.* has no action slot, so this one toast goes straight to sonner.
        toast.success("Assignment ended", {
          description,
          action: {
            label: TA_COPY.workforce.actions.findJob,
            onClick: () => void navigate({ to: "/ta/workforce", search: { tab: "redeployment" } }),
          },
        });
      } else {
        notify.success("Assignment ended", description);
      }
    },
    onError: (error) => notify.error("Unable to end assignment", error),
  });

  const missing = startsLater ? "This assignment has not started yet." : !actualEnd ? "Enter the last working date." : !reason.trim() ? "Add a reason." : !disposition ? "Choose what happens next." : "";

  return <Dialog open={open} onClose={onClose} title="End assignment" description={`Record the last working date and next step for ${employeeName}.`}>
    <div className="space-y-4">
      {startsLater ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {employeeName || "This worker"} starts on {formatDate(earliestEnd)}. You can end the assignment from that date.
        </p>
      ) : (
        <DateField label="Actual last working date" value={actualEnd} min={earliestEnd || undefined} max={getManilaToday()} onChange={(event) => setActualEnd(event.target.value)} required />
      )}
      <div className="space-y-1">
        <Select label="Worker’s next step" value={disposition} onChange={(event) => setDisposition(event.target.value as Disposition | "")} options={[
          { value: "", label: "Choose what happens next" },
          { value: "AVAILABLE_FOR_REDEPLOYMENT", label: TA_COPY.workforce.dispositions.wantsAnother }, { value: "NOT_CONFIRMED", label: TA_COPY.workforce.dispositions.notConfirmed }, { value: "SEPARATED", label: TA_COPY.workforce.dispositions.leaving },
        ]} />
        {disposition && <p className="text-xs text-slate-600">{DISPOSITION_HELP[disposition]}</p>}
      </div>
      <Textarea label="Reason for ending this assignment" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required placeholder="For example: client assignment ended or worker requested a transfer" />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-3">
        {missing && <span className="text-xs text-slate-600">{missing}</span>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={Boolean(missing)} loading={mutation.isPending} onClick={() => mutation.mutate()}>End assignment</Button>
      </div>
    </div>
  </Dialog>;
};
