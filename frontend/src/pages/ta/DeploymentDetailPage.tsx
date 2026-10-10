import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import {
  History,
  ArrowLeft,
  Edit,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";
import { getManilaToday } from "../../lib/field-limits";
import { EndAssignmentDialog } from "../../components/ta/EndAssignmentDialog";

export const DeploymentDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { deploymentId } = useParams({ strict: false }) as { deploymentId: string };

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");
  const [actualStart, setActualStart] = useState(getManilaToday());
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [agreementEnd, setAgreementEnd] = useState("");
  const [agreementHasNoEnd, setAgreementHasNoEnd] = useState(false);
  const [agreementTerms, setAgreementTerms] = useState("");

  const deploymentQuery = useQuery({
    queryKey: ["ta", "deployment", deploymentId],
    queryFn: () => taApi.getDeploymentDetails(deploymentId),
    enabled: Boolean(deploymentId),
  });


  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: DeploymentStatus; notes?: string; actualStart?: string }) =>
      taApi.updateDeploymentStatus(deploymentId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setStatusModalOpen(false);
      setStatusNotes("");
      notify.success("Deployment status updated", `The assignment is now ${getDeploymentStatusMeta(vars.status).label}.`);
    },
    onError: (err: any) => {
      notify.error("Unable to update deployment status", err);
    },
  });

  const updateAgreementMutation = useMutation({
    mutationFn: () => taApi.updateDeploymentContract(deploymentId, {
      contractEnd: agreementHasNoEnd ? null : agreementEnd || null,
      contractTerms: agreementTerms.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setAgreementModalOpen(false);
      notify.success("Agreement updated", "The previous agreement details are preserved in the record history.");
    },
    onError: (error: any) => notify.error("Could not update agreement", error?.message || error),
  });

  if (deploymentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment details" description="Loading assignment details..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (deploymentQuery.isError || !deploymentQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment details" description="Assignment details" />
        <ErrorState error={deploymentQuery.error} onRetry={() => deploymentQuery.refetch()} />
      </div>
    );
  }

  const dep = deploymentQuery.data;
  const emp = dep.employee;
  const profile = emp?.user?.applicantProfile;
  const empName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : emp?.employeeNumber || "Employee";
  const history = dep.statusHistory || [];
  const allowedNext = (ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || []).filter((status) => status !== DeploymentStatus.ENDED);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Deployment: ${empName}`}
        description={`Record #${dep.id} • Assigned to ${dep.client?.name || "Client Site"}`}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=deployments" },
          { label: `Deployment #${dep.id}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/workforce" search={{ tab: "deployments" }}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to deployments
              </Button>
            </Link>
            {allowedNext.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit className="w-3.5 h-3.5" />}
                onClick={() => {
                  setNewStatus(allowedNext[0]);
                  const defaultStart = dep.contractStart && dep.contractStart.slice(0, 10) >= getManilaToday()
                    ? dep.contractStart.slice(0, 10)
                    : getManilaToday();
                  setActualStart(defaultStart);
                  setStatusModalOpen(true);
                }}
              >
                Update status
              </Button>
            )}
            {(dep.status === DeploymentStatus.ACTIVE || dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT) && (
              <Button variant="outline" size="sm" onClick={() => {
                setAgreementEnd(dep.contractEnd?.slice(0, 10) || "");
                setAgreementHasNoEnd(!dep.contractEnd);
                setAgreementTerms("");
                setAgreementModalOpen(true);
              }}>Update agreement</Button>
            )}
            {dep.status === DeploymentStatus.ACTIVE && <Button variant="outline" size="sm" onClick={() => setEndModalOpen(true)}>End assignment</Button>}
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assignment Metadata */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Deployment details
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Current status</span>
              <StatusBadge status={dep.status} employeeStatus={dep.employee?.status} type="deployment" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Client</span>
              <span className="font-bold text-slate-900">{dep.client?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Site</span>
              <span className="font-semibold text-slate-800">{dep.site || "General Facility"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Contract dates</span>
              <span className="font-mono text-slate-800">
                {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Actual assignment</span>
              <span className="font-mono text-slate-800">{dep.actualStart ? formatDate(dep.actualStart) : dep.status === DeploymentStatus.READY_FOR_DEPLOYMENT ? "Not started" : "Start date not recorded"} to {dep.actualEnd ? formatDate(dep.actualEnd) : dep.status === DeploymentStatus.ACTIVE ? "Ongoing" : dep.status === DeploymentStatus.ENDED ? "End date not recorded" : "—"}</span>
            </div>
            {dep.status === DeploymentStatus.ACTIVE && <div className="flex items-center justify-between"><span className="text-slate-500">Next check-in</span><span className="font-mono text-slate-800">{dep.nextReviewAt ? formatDate(dep.nextReviewAt) : "Not scheduled"}</span></div>}
            {dep.notes && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-500 block">Notes</span>
                <p className="text-slate-600 mt-0.5">{dep.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Employee Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Employee details
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Employee</span>
              <span className="font-bold text-slate-900">{empName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Employee number</span>
              <span className="font-mono text-slate-800">{emp?.employeeNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Phone</span>
              <span className="font-mono text-slate-800">{profile?.mobileNumber || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Email</span>
              <span className="font-mono text-slate-800">{emp?.user?.email || "N/A"}</span>
            </div>
            <div className="pt-2">
              <Link to="/ta/employees/$employeeId" params={{ employeeId: String(emp?.id || 0) }}>
                <Button variant="outline" size="sm" className="w-full">
                  View employee record
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* State Machine Transition Audit Log */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <History className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Status history
          </h3>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400">
            No status history transitions logged. Current state: {getDeploymentStatusMeta(dep.status).label}.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 font-mono">
                    {h.fromStatus ? getDeploymentStatusMeta(h.fromStatus).label : "INITIAL"} → {getDeploymentStatusMeta(h.toStatus).label}
                  </div>
                  {h.reason && <p className="text-slate-600">"{h.reason}"</p>}
                </div>
                <div className="text-[11px] text-slate-400 font-mono text-right shrink-0">
                  {formatDateTime(h.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {dep.agreementVersions && dep.agreementVersions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">Previous agreement versions</h3>
          <div className="divide-y divide-slate-100">
            {dep.agreementVersions.map((version) => (
              <div key={version.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-xs">
                <div>
                  <div className="font-semibold text-slate-900">Recorded {formatDateTime(version.recordedAt)}</div>
                  <div className="mt-1 text-slate-600">Agreement dates: {version.contractStart ? formatDate(version.contractStart) : "N/A"} to {version.contractEnd ? formatDate(version.contractEnd) : "Open"}</div>
                  {version.contractStatus && <div className="mt-0.5 text-slate-500">Status: {version.contractStatus}</div>}
                  {version.contractTerms && <p className="mt-1 max-w-3xl whitespace-pre-wrap text-slate-600">{version.contractTerms}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {dep.reviews && dep.reviews.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">Assignment check-ins</h3>
          <div className="divide-y divide-slate-100">
            {dep.reviews.map((review) => (
              <div key={review.id} className="flex flex-wrap justify-between gap-3 py-3 text-xs">
                <div><div className="font-semibold text-slate-900">{formatDateTime(review.reviewedAt)}{review.reviewedBy?.email ? ` · ${review.reviewedBy.email}` : ""}</div>{review.notes && <p className="mt-1 text-slate-600">{review.notes}</p>}</div>
                <div className="text-slate-600">Next check-in: {review.nextReviewAt ? formatDate(review.nextReviewAt) : "Not scheduled"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <EndAssignmentDialog open={endModalOpen} deploymentId={deploymentId} employeeName={empName} onClose={() => setEndModalOpen(false)} />
      {/* Status Modal */}
      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={newStatus === DeploymentStatus.ACTIVE ? "Confirm site start" : "Update deployment status"}
        description={newStatus === DeploymentStatus.ACTIVE ? "Record the date the employee actually started at the client site." : "Update the scheduled placement status."}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
            <span className="text-slate-500">Current status</span>
            <StatusBadge status={dep.status} type="deployment" />
          </div>

          {newStatus === DeploymentStatus.ACTIVE ? (
            <Input
              label="Actual first working date"
              type="date"
              value={actualStart}
              min={getManilaToday()}
              onChange={(event) => setActualStart(event.target.value)}
              helperText="Must be today or a future date."
              required
            />
          ) : <Select
            label="New status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as DeploymentStatus)}
            options={allowedNext.map((s) => ({
              value: s,
              label: getDeploymentStatusMeta(s).label,
            }))}
          />}
          <Textarea
            label="Notes (optional)"
            placeholder="Add a reason or note for this change..."
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={updateStatusMutation.isPending}
              disabled={newStatus === DeploymentStatus.ACTIVE && (!actualStart || actualStart < getManilaToday())}
              onClick={() =>
                updateStatusMutation.mutate({
                  status: newStatus,
                  notes: statusNotes || undefined,
                  actualStart: newStatus === DeploymentStatus.ACTIVE ? actualStart : undefined,
                })
              }
            >
              {newStatus === DeploymentStatus.ACTIVE ? "Confirm start" : "Save status"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={agreementModalOpen} onClose={() => setAgreementModalOpen(false)} title="Update assignment agreement" description="Record an actual agreement extension or amendment. This does not end the worker’s assignment." size="md">
        <div className="space-y-4">
          <Input label="Agreement end date (if specified)" type="date" value={agreementEnd} min={dep.contractStart?.slice(0, 10) || undefined} onChange={(event) => setAgreementEnd(event.target.value)} disabled={agreementHasNoEnd} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={agreementHasNoEnd} onChange={(event) => { setAgreementHasNoEnd(event.target.checked); if (event.target.checked) setAgreementEnd(""); }} />
            This agreement has no fixed end date
          </label>
          <Textarea label="Agreement update notes" value={agreementTerms} onChange={(event) => setAgreementTerms(event.target.value)} rows={3} placeholder="Record the extension or amendment details." />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setAgreementModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={updateAgreementMutation.isPending} onClick={() => updateAgreementMutation.mutate()}>Save agreement update</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

