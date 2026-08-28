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
  FileCheck2,
  CheckCircle2,
  Clock,
  PenTool,
} from "lucide-react";
import { notify } from "../../lib/feedback";

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

  const signContractMutation = useMutation({
    mutationFn: (party: "WORKER" | "CLIENT") =>
      taApi.signDeploymentContract(deploymentId, { party }),
    onSuccess: (_, party) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      notify.success(
        "Contract Signature Recorded",
        `${party === "WORKER" ? "Worker / Candidate" : "Client Representative"} signature saved.`
      );
    },
    onError: (err: any) => {
      notify.error("Signature Recording Failed", err);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: DeploymentStatus; notes?: string }) =>
      taApi.updateDeploymentStatus(deploymentId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["ta", "deployment", deploymentId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "deployments"] });
      setStatusModalOpen(false);
      setStatusNotes("");
      notify.success("Deployment Status Updated", `Deployment status transitioned to ${getDeploymentStatusMeta(vars.status).label}.`);
    },
    onError: (err: any) => {
      notify.error("Status Update Failed", err);
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

      {/* Deployment Contract & Bilateral Agreement */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Deployment Contract & Bilateral Review
              </h3>
              <p className="text-xs text-slate-500">
                Worker and Client mutual endorsement and execution before active site entry
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full uppercase border ${
              dep.contractStatus === "FULLY_EXECUTED"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                : dep.workerSigned || dep.clientSigned
                ? "bg-amber-50 text-amber-800 border-amber-300"
                : "bg-slate-100 text-slate-700 border-slate-300"
            }`}
          >
            {dep.contractStatus ? dep.contractStatus.replace(/_/g, " ") : "PENDING SIGNATURES"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Worker / Candidate Signature Block */}
          <div
            className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
              dep.workerSigned
                ? "bg-emerald-50/50 border-emerald-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                  Party 1: Worker / Candidate
                </span>
                <h4 className="text-sm font-bold text-slate-900">{empName}</h4>
              </div>
              {dep.workerSigned ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SIGNED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded">
                  <Clock className="w-3.5 h-3.5" />
                  AWAITING
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 font-mono">
              {dep.workerSigned ? (
                <span>Signed on {dep.workerSignedAt ? formatDateTime(dep.workerSignedAt) : "File"}</span>
              ) : (
                <span>Candidate agreement required before active onboarding</span>
              )}
            </div>

            {!dep.workerSigned && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<PenTool className="w-3.5 h-3.5" />}
                loading={signContractMutation.isPending}
                onClick={() => signContractMutation.mutate("WORKER")}
                className="w-full"
              >
                Record Worker Signature
              </Button>
            )}
          </div>

          {/* Client Partner Signature Block */}
          <div
            className={`p-4 rounded-lg border flex flex-col justify-between space-y-3 ${
              dep.clientSigned
                ? "bg-emerald-50/50 border-emerald-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                  Party 2: Corporate Client
                </span>
                <h4 className="text-sm font-bold text-slate-900">{dep.client?.name || "Client Representative"}</h4>
              </div>
              {dep.clientSigned ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SIGNED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-mono text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  AWAITING
                </span>
              )}
            </div>

            <div className="text-xs text-slate-600 font-mono">
              {dep.clientSigned ? (
                <span>Signed on {dep.clientSignedAt ? formatDateTime(dep.clientSignedAt) : "File"}</span>
              ) : (
                <span>Client acceptance & SLA signing required before active entry</span>
              )}
            </div>

            {!dep.clientSigned && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<PenTool className="w-3.5 h-3.5" />}
                loading={signContractMutation.isPending}
                onClick={() => signContractMutation.mutate("CLIENT")}
                className="w-full"
              >
                Record Client Signature
              </Button>
            )}
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

