import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { EmploymentStatus } from "../../lib/types/enums";
import {
  User,
  Truck,
  History,
  ShieldCheck,
  GraduationCap,
  ArrowLeft,
  Edit,
} from "lucide-react";

type TabKey =
  | "identity"
  | "history"
  | "deployments"
  | "compliance"
  | "qualifications";

export const EmployeeDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { employeeId } = useParams({ strict: false }) as { employeeId: string };

  const validTabs: TabKey[] = [
    "identity",
    "history",
    "deployments",
    "compliance",
    "qualifications",
  ];

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab") as TabKey;
      if (paramTab && validTabs.includes(paramTab)) {
        return paramTab;
      }
    }
    return "identity";
  });

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<EmploymentStatus>(EmploymentStatus.ACTIVE);
  const [statusReason, setStatusReason] = useState("");

  const digital201Query = useQuery({
    queryKey: ["ta", "employee", employeeId, "201"],
    queryFn: () => employeesApi.getDigital201(employeeId),
    enabled: Boolean(employeeId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: { status: EmploymentStatus; reason?: string }) =>
      employeesApi.updateEmployeeStatus(employeeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId] });
      setStatusModalOpen(false);
    },
  });

  if (digital201Query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Digital 201 File" description="Loading personnel record..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (digital201Query.isError || !digital201Query.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Digital 201 File" description="Personnel file" />
        <ErrorState error={digital201Query.error} onRetry={() => digital201Query.refetch()} />
      </div>
    );
  }

  const data = digital201Query.data;
  const emp = data.employee;
  const cand = data.candidate || ({} as any);
  const empName = `${cand.firstName || ""} ${cand.lastName || ""}`.trim() || emp.employeeNumber;
  const deployments = data.deployments || [];
  const events = data.employmentHistory || [];
  const compliance = data.compliance || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Digital 201: ${empName}`}
        description={`Employee Number: ${emp.employeeNumber} • Hired ${formatDate(emp.hireDate)}`}
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Personnel", href: "/ta/employees" },
          { label: emp.employeeNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/employees">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Roster
              </Button>
            </Link>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Edit className="w-3.5 h-3.5" />}
              onClick={() => {
                setNewStatus(emp.status);
                setStatusModalOpen(true);
              }}
            >
              Change Employment Status
            </Button>
          </div>
        }
      />

      {/* Header Snapshot Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold uppercase text-slate-500">Status:</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                  emp.status === EmploymentStatus.ACTIVE
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : emp.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT
                    ? "bg-teal-50 text-teal-800 border border-teal-200"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {emp.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Position: {emp.position || "General Staff"} • Department: {emp.department || "Operations"}
            </div>
          </div>

          <div className="text-xs text-slate-600 font-mono text-right">
            <div>Hire Date: {formatDate(emp.hireDate)}</div>
            <div>Total Deployments: {deployments.length}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto pt-1">
          {[
            { id: "identity", label: "Legal Identity & Statutory", icon: User },
            { id: "history", label: `Event Timeline (${events.length})`, icon: History },
            { id: "deployments", label: `Deployments (${deployments.length})`, icon: Truck },
            { id: "compliance", label: `Clearance Vault (${compliance.length})`, icon: ShieldCheck },
            { id: "qualifications", label: "Qualifications on File", icon: GraduationCap },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id as TabKey)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-teal-50 text-teal-900 border border-teal-200 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-teal-700" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Body */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        {/* TAB 1: IDENTITY & STATUTORY */}
        {activeTab === "identity" && (
          <div className="space-y-6">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Statutory Government IDs & Civil Demographics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">SSS Number</span>
                <span className="font-bold font-mono text-slate-900">{cand.sss || "Pending Submission"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">PhilHealth PIN</span>
                <span className="font-bold font-mono text-slate-900">{cand.philhealth || "Pending Submission"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Pag-IBIG MID</span>
                <span className="font-bold font-mono text-slate-900">{cand.pagibig || "Pending Submission"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Residential Address</span>
                <span className="text-slate-800">{cand.address || "N/A"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Contact Mobile</span>
                <span className="font-mono text-slate-800">{cand.mobileNumber || "N/A"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Emergency Contact</span>
                <span className="text-slate-800">
                  {cand.emergencyContactName ? `${cand.emergencyContactName} (${cand.emergencyContactPhone || ""})` : "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EMPLOYMENT HISTORY & EVENTS */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Career Milestone Audit Log
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No historical employment events recorded.</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div key={ev.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 font-mono">{ev.eventType}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{formatDateTime(ev.effectiveDate)}</span>
                    </div>
                    <p className="text-slate-700">{ev.description}</p>
                    {ev.actor && <div className="text-[10px] text-slate-400 font-mono">Logged by {ev.actor.email}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FIELD DEPLOYMENTS */}
        {activeTab === "deployments" && (
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Client Site Deployments
            </h3>
            {deployments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No field deployments assigned.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deployments.map((dep) => (
                  <div key={dep.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900">{dep.client?.name || "Client"}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Site: {dep.site || "General Facility"} • Schedule: {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}
                      </div>
                    </div>
                    <StatusBadge status={dep.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CLEARANCE VAULT */}
        {activeTab === "compliance" && (
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Pre-Employment Clearances & Vault 201
            </h3>
            {compliance.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No compliance documents attached.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {compliance.map((req: any) => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{req.documentLabel}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Status: {req.reviewStatus}</div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                      {req.reviewStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: QUALIFICATIONS */}
        {activeTab === "qualifications" && (
          <div className="space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Verified Qualifications
            </h3>
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Skills on Record:</span>
              <div className="flex flex-wrap gap-1.5">
                {data.skills && data.skills.length > 0 ? (
                  data.skills.map((s, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No skills listed</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Status Modal */}
      <Dialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Update Personnel Status"
        description={`Set employment state for ${empName}`}
      >
        <div className="space-y-4">
          <Select
            label="Employment Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as EmploymentStatus)}
            options={[
              { value: EmploymentStatus.ACTIVE, label: "ACTIVE" },
              {
                value: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT,
                label: "AVAILABLE FOR REDEPLOYMENT",
              },
              { value: EmploymentStatus.INACTIVE, label: "INACTIVE" },
              { value: EmploymentStatus.SEPARATED, label: "SEPARATED" },
            ]}
          />
          <Textarea
            label="Administrative Reason / Audit Note"
            placeholder="e.g. End of contract at Client site; returned to redeployment pool"
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
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
                  reason: statusReason || undefined,
                })
              }
            >
              Save Status
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
