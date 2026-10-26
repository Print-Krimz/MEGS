import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState } from "../../../common";
import { DateField } from "../../../common/DateField";
import { Button, ComboBox, Dialog, Select, Textarea } from "../../../ui";
import { employeesApi } from "../../../../lib/api/employees.api";
import { taApi } from "../../../../lib/api/ta.api";
import { getManilaToday } from "../../../../lib/field-limits";
import { notify } from "../../../../lib/feedback";
import { TA_COPY } from "../../../../lib/ta-copy";
import { EmploymentStatus } from "../../../../lib/types/enums";

/** Change the employment status, with an optional reason. */
export const ChangeStatusDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  currentStatus: EmploymentStatus;
}> = ({ open, onClose, employeeId, employeeName, currentStatus }) => {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState<EmploymentStatus>(EmploymentStatus.ACTIVE);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setNewStatus(currentStatus);
    // The status is read once per opening, so a refetch does not change the choice under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: (data: { status: EmploymentStatus; reason?: string }) => employeesApi.updateEmployeeStatus(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId] });
      onClose();
      notify.success("Employment status updated", "The employee status has been updated.");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      notify.error("Status update failed", err?.message || "Unable to update status.");
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Change employment status" description={`Set employment state for ${employeeName}`}>
      <div className="space-y-4">
        <Select
          label="Employment status"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value as EmploymentStatus)}
          options={[
            { value: EmploymentStatus.ACTIVE, label: "Active" },
            { value: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT, label: "Available for redeployment" },
            { value: EmploymentStatus.INACTIVE, label: "Inactive" },
            { value: EmploymentStatus.SEPARATED, label: "Separated" },
          ]}
        />
        <Textarea
          label="Reason (optional)"
          placeholder="e.g. End of contract; available for redeployment"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={mutation.isPending}
            onClick={() => mutation.mutate({ status: newStatus, reason: reason || undefined })}
          >
            Save status
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export type ValidityStatus = "HAS_EXPIRY" | "NO_EXPIRY" | "UNKNOWN";

/** Record issue and expiry dates for a verified document. */
export const RecordValidityDialog: React.FC<{
  target: { id: number; label: string } | null;
  initial: { validityStatus: ValidityStatus; issuedAt: string; expiresAt: string };
  onClose: () => void;
  employeeId: string;
}> = ({ target, initial, onClose, employeeId }) => {
  const queryClient = useQueryClient();
  const [validityStatus, setValidityStatus] = useState<ValidityStatus>("UNKNOWN");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (!target) return;
    setValidityStatus(initial.validityStatus);
    setIssuedAt(initial.issuedAt);
    setExpiresAt(initial.expiresAt);
    // Seed the fields when a document is chosen, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Select a document first.");
      return taApi.reviewComplianceRequirement(target.id, {
        reviewStatus: "APPROVED",
        validityStatus,
        issuedAt: issuedAt || null,
        expiresAt: validityStatus === "HAS_EXPIRY" ? expiresAt || null : null,
        reviewNotes: "Document validity checked in the employee Clearance Vault.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId, "201"] });
      onClose();
      notify.success("Document validity saved", "The verified validity information is now recorded.");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => notify.error("Could not save document validity", err?.message || err),
  });

  return (
    <Dialog open={Boolean(target)} onClose={onClose} title="Record document validity" description={target?.label}>
      <div className="space-y-4">
        <DateField label="Issue date (if shown)" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} max={getManilaToday()} />
        <Select
          label="Validity"
          value={validityStatus}
          onChange={(event) => setValidityStatus(event.target.value as ValidityStatus)}
          options={[
            { value: "UNKNOWN", label: "Not verified" },
            { value: "HAS_EXPIRY", label: "Has an expiry date" },
            { value: "NO_EXPIRY", label: "No expiry shown" },
          ]}
        />
        {validityStatus === "HAS_EXPIRY" && (
          <DateField label="Expiry date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />
        )}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={validityStatus === "HAS_EXPIRY" && !expiresAt}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save validity
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

/** Invite an employee who is available for redeployment to one open job. */
export const PlacementDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  employeeName: string;
  applicantProfileId: number | null;
  hasPortalAccess: boolean;
}> = ({ open, onClose, employeeName, applicantProfileId, hasPortalAccess }) => {
  const [targetJobId, setTargetJobId] = useState("");
  const [message, setMessage] = useState("");

  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!applicantProfileId || !targetJobId) throw new Error("Choose an open role first.");
      return taApi.sendTalentPoolInvitation({
        applicantProfileId,
        targetJobId: Number(targetJobId),
        message: message.trim() || "Your previous assignment has ended. Please review this opportunity and accept if you are interested.",
        expiresInDays: 7,
      });
    },
    onSuccess: () => {
      onClose();
      setTargetJobId("");
      setMessage("");
      notify.success(
        "Invitation sent",
        hasPortalAccess
          ? "The applicant can review and accept it from their account."
          : "Record their reply or text them an offer link from the pending invitation."
      );
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => notify.error("Could not send invitation", error?.message || error),
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={TA_COPY.workforce.actions.findJob}
      description={
        hasPortalAccess
          ? `Choose an open role to invite ${employeeName} to. They accept it from their applicant account.`
          : `Choose an open role to invite ${employeeName} to. They have no applicant account, so you record their reply.`
      }
    >
      <div className="space-y-4">
        {openJobsQuery.isError ? (
          <ErrorState error={openJobsQuery.error} onRetry={() => openJobsQuery.refetch()} />
        ) : (
          <ComboBox
            label="Open role"
            placeholder="Search open roles and clients"
            value={targetJobId}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            options={(openJobsQuery.data || []).map((job: any) => ({
              value: String(job.id),
              label: job.title,
              subtitle: job.mrf?.client?.name || "Client not assigned",
            }))}
            onChange={(value) => setTargetJobId(value)}
          />
        )}
        <Textarea
          label="Message (optional)"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="Add a short note about the role or work site."
        />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!targetJobId || !applicantProfileId}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {TA_COPY.workforce.actions.sendInvitation}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
