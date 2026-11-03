import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Dialog, Select, Textarea } from "../../ui";
import { DateField } from "../../common/DateField";
import { taApi, type BulkApproveResult } from "../../../lib/api/ta.api";
import { formatErrorMessage } from "../../../lib/feedback";
import type { RequirementRowData } from "./RequirementRow";

type Validity = "" | "HAS_EXPIRY" | "NO_EXPIRY";

export interface BulkApproveRequirementsDialogProps {
  applicationId: string | number;
  /** The documents the reviewer opened and ticked, in list order. */
  requirements: RequirementRowData[];
  onClose: () => void;
  /** Called with the ids that were approved, so the tab can clear them from the selection. */
  onApproved: (requirementIds: number[]) => void;
}

/** Approves the ticked documents in one go. Mount it only while open. */
export const BulkApproveRequirementsDialog: React.FC<BulkApproveRequirementsDialogProps> = ({ applicationId, requirements, onClose, onApproved }) => {
  const queryClient = useQueryClient();
  const [validity, setValidity] = useState<Record<number, Validity>>({});
  const [expiry, setExpiry] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkApproveResult[] | null>(null);

  const labelOf = (id: number) => requirements.find((r) => r.id === id)?.documentLabel ?? "Requirement";
  const complete = requirements.every((r) => validity[r.id] === "NO_EXPIRY" || (validity[r.id] === "HAS_EXPIRY" && Boolean(expiry[r.id])));

  const approve = useMutation({
    mutationFn: () =>
      taApi.bulkApproveComplianceRequirements(applicationId, {
        reviewNotes: notes.trim(),
        entries: requirements.map((r) => ({
          requirementId: r.id,
          validityStatus: validity[r.id] as "HAS_EXPIRY" | "NO_EXPIRY",
          expiresAt: validity[r.id] === "HAS_EXPIRY" ? expiry[r.id] : null,
        })),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "application", String(applicationId)] });
      queryClient.invalidateQueries({ queryKey: ["ta", "applications"] });
      setResults(data.results);
      onApproved(data.results.filter((r) => r.status === "approved").map((r) => r.requirementId));
    },
    onError: (err: unknown) => setServerError(formatErrorMessage(err)),
  });

  // Step 2: what happened to each document.
  if (results) {
    const failed = results.filter((r) => r.status === "failed");
    const approvedCount = results.length - failed.length;
    return (
      <Dialog
        open
        onClose={onClose}
        title={failed.length === 0 ? "Documents approved" : approvedCount === 0 ? "Nothing was approved" : "Some documents were not approved"}
        description={failed.length > 0 && approvedCount > 0 ? `${approvedCount} approved, ${failed.length} not approved. The rest stay selected so you can retry.` : undefined}
      >
        <div className="space-y-4">
          <ul className="divide-y divide-slate-100 border border-slate-200 text-sm" aria-label="Approval results">
            {results.map((r) => (
              <li key={r.requirementId} className="flex flex-col gap-0.5 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-slate-900">{labelOf(r.requirementId)}</span>
                {r.status === "approved" ? (
                  <span className="text-emerald-800">Approved</span>
                ) : (
                  <span role="alert" className="text-rose-700">Not approved: {r.error}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      size="lg"
      onClose={approve.isPending ? () => undefined : onClose}
      title={`Approve ${requirements.length} ${requirements.length === 1 ? "document" : "documents"}`}
      description="Confirm each document's validity. The note is saved on every approval and the applicant is notified."
    >
      <div className="space-y-4">
        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto border border-slate-200" aria-label="Documents to approve">
          {requirements.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start sm:justify-between">
              <span className="min-w-0 pt-2 text-sm font-medium text-slate-900">{r.documentLabel}</span>
              <div className="flex flex-col gap-2 sm:w-64">
                <Select
                  aria-label={`Validity of ${r.documentLabel}`}
                  value={validity[r.id] ?? ""}
                  onChange={(e) => setValidity((prev) => ({ ...prev, [r.id]: e.target.value as Validity }))}
                  options={[
                    { value: "", label: "Choose…" },
                    { value: "HAS_EXPIRY", label: "Has an expiry date" },
                    { value: "NO_EXPIRY", label: "No expiry" },
                  ]}
                />
                {validity[r.id] === "HAS_EXPIRY" && (
                  <DateField label="Expiry date" value={expiry[r.id] ?? ""} onChange={(e) => setExpiry((prev) => ({ ...prev, [r.id]: e.target.value }))} required />
                )}
              </div>
            </li>
          ))}
        </ul>

        <Textarea
          label="Notes for the candidate"
          required
          placeholder="Explain what was verified."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {serverError && <p role="alert" className="text-xs font-medium text-rose-600">{serverError}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={approve.isPending}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            loading={approve.isPending}
            disabled={!complete || !notes.trim()}
            onClick={() => {
              setServerError(null);
              approve.mutate();
            }}
          >
            {requirements.length > 1 ? `Approve ${requirements.length} documents` : "Approve"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
