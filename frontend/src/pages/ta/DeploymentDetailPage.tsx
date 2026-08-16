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
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime, getDeploymentStatusMeta } from "../../lib/utils";
import { DeploymentStatus, ALLOWED_DEPLOYMENT_TRANSITIONS } from "../../lib/types/enums";
import {
  History,
  ArrowLeft,
  Edit,
} from "lucide-react";

export const DeploymentDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { deploymentId } = useParams({ strict: false }) as { deploymentId: string };

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<DeploymentStatus>(DeploymentStatus.ACTIVE);
  const [statusNotes, setStatusNotes] = useState("");

  const deploymentQuery = useQuery({
    queryKey: ["ta", "deployment", deploymentId],
    queryFn: () => taApi.getDeploymentDetails(deploymentId),
    enabled: Boolean(deploymentId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: DeploymentStatus; notes?: string }) =>
      taApi.updateDeploymentStatus(deploymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      setStatusModalOpen(false);
      setStatusNotes("");
    },
  });

  if (deploymentQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment Record" description="Loading assignment data..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (deploymentQuery.isError || !deploymentQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deployment Record" description="Assignment details" />
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
  const allowedNext = ALLOWED_DEPLOYMENT_TRANSITIONS[dep.status] || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Deployment: ${empName}`}
        description={`Record #${dep.id} • Assigned to ${dep.client?.name || "Client Site"}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Deployments", href: "/ta/deployments" },
          { label: `Assignment #${dep.id}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/deployments">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Deployments
              </Button>
            </Link>
            {allowedNext.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Edit className="w-3.5 h-3.5" />}
                onClick={() => {
                  setNewStatus(allowedNext[0]);
                  setStatusModalOpen(true);
                }}
              >
                Update Status
              </Button>
            )}
          </div>
        }
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assignment Metadata */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Deployment Specifications
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Current Status:</span>
              <StatusBadge status={dep.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Client Account:</span>
              <span className="font-bold text-slate-900">{dep.client?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Designated Site:</span>
              <span className="font-semibold text-slate-800">{dep.site || "General Facility"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Contract Schedule:</span>
              <span className="font-mono text-slate-800">
                {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}
              </span>
            </div>
            {dep.notes && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 font-mono block">Notes:</span>
                <p className="text-slate-600 mt-0.5">{dep.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Employee Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
            Employee Personnel Details
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Personnel Name:</span>
              <span className="font-bold text-slate-900">{empName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Employee Number:</span>
              <span className="font-mono text-slate-800">{emp?.employeeNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Contact Phone:</span>
              <span className="font-mono text-slate-800">{profile?.mobileNumber || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono">Official Email:</span>
              <span className="font-mono text-slate-800">{emp?.user?.email || "N/A"}</span>
            </div>
            <div className="pt-2">
              <Link to="/ta/employees/$employeeId" params={{ employeeId: String(emp?.id || 0) }}>
                <Button variant="outline" size="sm" className="w-full">
                  View Digital 201 File
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
            Deployment Lifecycle State Transitions
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

      {/* Status Modal */}
      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Deployment Status"
        description="Update the employee's current deployment status."
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
            <span className="text-slate-500 font-mono">Current Status:</span>
            <StatusBadge status={dep.status} />
          </div>

          <Select
            label="Target Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as DeploymentStatus)}
            options={allowedNext.map((s) => ({
              value: s,
              label: getDeploymentStatusMeta(s).label,
            }))}
          />
          <Textarea
            label="Status Notes / Coordinator Remarks"
            placeholder="Document reason or remarks for this status update..."
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
              onClick={() =>
                updateStatusMutation.mutate({
                  status: newStatus,
                  notes: statusNotes || undefined,
                })
              }
            >
              Confirm Status
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

