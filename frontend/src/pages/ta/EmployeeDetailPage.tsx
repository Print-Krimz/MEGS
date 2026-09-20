import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  Tabs,
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
import { TA_COPY } from "../../lib/ta-copy";

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
        <PageHeader title="Employee record (201)" description="Loading employee details..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (digital201Query.isError || !digital201Query.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee record (201)" description="Employee details" />
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
        title={empName}
        description={`Employee no. ${emp.employeeNumber} • Hired ${formatDate(emp.hireDate)}`}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=employees" },
          { label: emp.employeeNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/ta/workforce" search={{ tab: "employees" }}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to employee records
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
              Change employment status
            </Button>
          </div>
        }
      />

      {/* Header Snapshot Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">Status</span>
              <StatusBadge status={emp.status} type="employment" size="sm" />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Position: {emp.position || "General staff"} • Department: {emp.department || "Operations"}
            </div>
          </div>

          <div className="text-xs text-slate-600 font-mono text-right">
            <div>Hire date: {formatDate(emp.hireDate)}</div>
            <div>Total deployments: {deployments.length}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onChange={(tab) => handleTabChange(tab as TabKey)}
          ariaLabel="Employee record sections"
          items={[
            { id: "identity", label: "Identity and IDs", icon: User, panelId: "employee-identity" },
            { id: "history", label: `History (${events.length})`, icon: History, panelId: "employee-history" },
            { id: "deployments", label: `Deployments (${deployments.length})`, icon: Truck, panelId: "employee-deployments" },
            { id: "compliance", label: `Requirements (${compliance.length})`, icon: ShieldCheck, panelId: "employee-compliance" },
            { id: "qualifications", label: "Qualifications", icon: GraduationCap, panelId: "employee-qualifications" },
          ]}
          className="border-b-0"
        />
      </div>

      {/* Tab Body */}
      <div id={`employee-${activeTab}`} role="tabpanel" tabIndex={0} className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700">
        {/* TAB 1: IDENTITY & STATUTORY */}
        {activeTab === "identity" && (
          <div className="space-y-6">
            <h3 className="text-xs font-mono font-bold uppercase text-slate-500 border-b border-slate-100 pb-2">
              Government IDs and personal details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="space-y-2">
                <span className="text-slate-500 block">SSS number</span>
                <span className="font-bold font-mono text-slate-900">{cand.sss || "Pending Submission"}</span>
              </div>
              <div className="space-y-2">
                <span className="text-slate-500 block">PhilHealth PIN</span>
                <span className="font-bold font-mono text-slate-900">{cand.philhealth || "Pending Submission"}</span>
              </div>
              <div className="space-y-2">
                <span className="text-slate-500 block">Pag-IBIG MID</span>
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
              Employment history
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
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-500">
              Client site deployments ({deployments.length})
              </h3>
              <Link to="/ta/workforce" search={{ tab: "deployments" }}>
                <span className="text-xs text-teal-700 hover:text-teal-900 font-semibold">
                  View all deployments →
                </span>
              </Link>
            </div>
            {deployments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No field deployments assigned.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {deployments.map((dep) => (
                  <div key={dep.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900">{dep.client?.name || "Client"}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Site: {dep.site || "General Facility"} • Schedule: {dep.contractStart ? formatDate(dep.contractStart) : "N/A"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "Open"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={dep.status} type="deployment" />
                      <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                        <Button variant="outline" size="sm">
                        View deployment
                        </Button>
                      </Link>
                    </div>
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
              Pre-employment requirements
            </h3>
            {compliance.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No compliance documents attached.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {compliance.map((req: any) => (
                  <div key={req.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{req.documentLabel}</div>
                    </div>
                    <StatusBadge status={req.reviewStatus} type="raw" size="sm" />
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
              Qualifications on file
            </h3>
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Skills on record</span>
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
        title="Change employment status"
        description={`Set employment state for ${empName}`}
      >
        <div className="space-y-4">
          <Select
            label="Employment status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as EmploymentStatus)}
            options={[
              { value: EmploymentStatus.ACTIVE, label: "Active" },
              {
                value: EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT,
                label: "Available for redeployment",
              },
              { value: EmploymentStatus.INACTIVE, label: "Inactive" },
              { value: EmploymentStatus.SEPARATED, label: "Separated" },
            ]}
          />
          <Textarea
            label="Reason (optional)"
            placeholder="e.g. End of contract; available for redeployment"
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
              Save status
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
