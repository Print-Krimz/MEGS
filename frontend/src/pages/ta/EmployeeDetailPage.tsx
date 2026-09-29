import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import type { UpdateEmployeeDetailsDto } from "../../lib/types/employee.types";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  Tabs,
} from "../../components/common";
import { Button, Dialog, Input, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { notify } from "../../lib/feedback";
import {
  formatSSSNumber,
  formatPhilHealthNumber,
  formatPagIbigNumber,
  formatTINNumber,
} from "../applicant/ProfilePage";
import { EmploymentStatus } from "../../lib/types/enums";
import {
  User,
  Truck,
  History,
  ShieldCheck,
  GraduationCap,
  ArrowLeft,
  Edit,
  Pencil,
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

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    mobileNumber: "",
    address: "",
    city: "",
    province: "",
    sss: "",
    philhealth: "",
    pagibig: "",
    tin: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactAddress: "",
    position: "",
    department: "",
  });

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
      notify.success("Employment status updated", "The employee status has been updated.");
    },
    onError: (err: any) => {
      notify.error("Status update failed", err?.message || "Unable to update status.");
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: (form: UpdateEmployeeDetailsDto) =>
      employeesApi.updateEmployeeDetails(employeeId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "employees"] });
      setEditModalOpen(false);
      notify.success("Employee updated", "Employee details were saved successfully.");
    },
    onError: (err: any) => {
      notify.error("Update failed", err?.message || "Unable to update employee details.");
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
  const cand = (data.candidate?.profile
    ? { ...data.candidate.profile, ...data.candidate }
    : (data.candidate || {})) as any;
  const empName = `${cand.firstName || ""} ${cand.lastName || ""}`.trim() || emp.employeeNumber;
  const deployments = data.deployments || [];
  const events = data.employmentHistory || [];
  const compliance = data.compliance || [];
  const skillsList: string[] =
    Array.isArray(data.skills) && data.skills.length > 0
      ? data.skills
      : Array.isArray(cand.skills)
      ? cand.skills
          .map((s: any) => (typeof s === "string" ? s : s.skill?.name || s.name || ""))
          .filter(Boolean)
      : [];
  const fullAddress = [cand.address, cand.city, cand.province].filter(Boolean).join(", ") || "N/A";
  const emergencyContactInfo = cand.emergencyContactName
    ? `${cand.emergencyContactName}${cand.emergencyContactRelationship ? ` (${cand.emergencyContactRelationship})` : ""}${cand.emergencyContactPhone ? ` • ${cand.emergencyContactPhone}` : ""}`
    : "N/A";

  const handleOpenEditModal = () => {
    setEditForm({
      firstName: cand.firstName || "",
      middleName: cand.middleName || "",
      lastName: cand.lastName || "",
      mobileNumber: cand.mobileNumber || "",
      address: cand.address || "",
      city: cand.city || "",
      province: cand.province || "",
      sss: cand.sss ? formatSSSNumber(cand.sss) : "",
      philhealth: cand.philhealth ? formatPhilHealthNumber(cand.philhealth) : "",
      pagibig: cand.pagibig ? formatPagIbigNumber(cand.pagibig) : "",
      tin: cand.tin ? formatTINNumber(cand.tin) : "",
      emergencyContactName: cand.emergencyContactName || "",
      emergencyContactRelationship: cand.emergencyContactRelationship || "",
      emergencyContactPhone: cand.emergencyContactPhone || "",
      emergencyContactAddress: cand.emergencyContactAddress || "",
      position: emp.position || "",
      department: emp.department || "",
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      notify.error("Validation error", "First name and last name are required.");
      return;
    }
    updateDetailsMutation.mutate({
      firstName: editForm.firstName.trim(),
      middleName: editForm.middleName.trim() || null,
      lastName: editForm.lastName.trim(),
      mobileNumber: editForm.mobileNumber.trim() || null,
      address: editForm.address.trim() || null,
      city: editForm.city.trim() || null,
      province: editForm.province.trim() || null,
      sss: editForm.sss.trim() || null,
      philhealth: editForm.philhealth.trim() || null,
      pagibig: editForm.pagibig.trim() || null,
      tin: editForm.tin.trim() || null,
      emergencyContactName: editForm.emergencyContactName.trim() || null,
      emergencyContactRelationship: editForm.emergencyContactRelationship.trim() || null,
      emergencyContactPhone: editForm.emergencyContactPhone.trim() || null,
      emergencyContactAddress: editForm.emergencyContactAddress.trim() || null,
      position: editForm.position.trim() || null,
      department: editForm.department.trim() || null,
    });
  };

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
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="w-3.5 h-3.5" />}
              onClick={handleOpenEditModal}
            >
              Edit employee details
            </Button>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
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
              <div className="space-y-2">
                <span className="text-slate-500 block">TIN</span>
                <span className="font-bold font-mono text-slate-900">{cand.tin || "Pending Submission"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs pt-4 border-t border-slate-100">
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Contact Mobile</span>
                <span className="font-mono text-slate-800">{cand.mobileNumber || "N/A"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Email</span>
                <span className="text-slate-800 font-mono">{cand.email || emp.user?.email || "N/A"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Residential Address</span>
                <span className="text-slate-800">{fullAddress}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Date of Birth & Gender</span>
                <span className="text-slate-800">
                  {`${cand.dateOfBirth ? formatDate(cand.dateOfBirth) : "N/A"}${cand.gender ? ` • ${cand.gender}` : ""}`}
                </span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Civil Status</span>
                <span className="text-slate-800">{cand.civilStatus || "Unspecified"}</span>
              </div>
              <div className="space-y-2">
                <span className="font-mono text-slate-400 block uppercase text-[10px]">Emergency Contact</span>
                <span className="text-slate-800">{emergencyContactInfo}</span>
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
                {skillsList.length > 0 ? (
                  skillsList.map((s, idx) => (
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

      {/* Edit Employee Details Modal */}
      <Dialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit employee details"
        description={`Update legal name, contact, statutory IDs, and job details for ${empName}`}
        size="xl"
      >
        <form onSubmit={handleSaveEdit} className="space-y-6">
          {/* Section 1: Legal Name */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Legal Name
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="First Name"
                required
                value={editForm.firstName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
              />
              <Input
                label="Middle Name"
                value={editForm.middleName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, middleName: e.target.value }))}
                placeholder="Middle name (optional)"
              />
              <Input
                label="Last Name"
                required
                value={editForm.lastName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Contact & Location
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Contact Mobile"
                value={editForm.mobileNumber}
                onChange={(e) => setEditForm((prev) => ({ ...prev, mobileNumber: e.target.value }))}
                placeholder="0917-000-0000"
              />
              <Input
                label="City"
                value={editForm.city}
                onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="City"
              />
              <Input
                label="Province"
                value={editForm.province}
                onChange={(e) => setEditForm((prev) => ({ ...prev, province: e.target.value }))}
                placeholder="Province"
              />
            </div>
            <div>
              <Input
                label="Residential Address"
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, building, or barangay"
              />
            </div>
          </div>

          {/* Section 3: Statutory Identification */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Statutory Identification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                label="SSS Number"
                value={editForm.sss}
                onChange={(e) => setEditForm((prev) => ({ ...prev, sss: formatSSSNumber(e.target.value) }))}
                placeholder="00-0000000-0"
                helperText="10 digits (00-0000000-0)"
              />
              <Input
                label="PhilHealth PIN"
                value={editForm.philhealth}
                onChange={(e) => setEditForm((prev) => ({ ...prev, philhealth: formatPhilHealthNumber(e.target.value) }))}
                placeholder="00-000000000-0"
                helperText="12 digits (00-000000000-0)"
              />
              <Input
                label="Pag-IBIG MID"
                value={editForm.pagibig}
                onChange={(e) => setEditForm((prev) => ({ ...prev, pagibig: formatPagIbigNumber(e.target.value) }))}
                placeholder="0000-0000-0000"
                helperText="12 digits (0000-0000-0000)"
              />
              <Input
                label="TIN Number"
                value={editForm.tin}
                onChange={(e) => setEditForm((prev) => ({ ...prev, tin: formatTINNumber(e.target.value) }))}
                placeholder="000-000-000-000"
                helperText="9-12 digits (000-000-000-000)"
              />
            </div>
          </div>

          {/* Section 4: Emergency Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Emergency Contact
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Contact Name"
                value={editForm.emergencyContactName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                placeholder="Full name"
              />
              <Input
                label="Relationship"
                value={editForm.emergencyContactRelationship}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactRelationship: e.target.value }))}
                placeholder="Relationship (e.g. Spouse)"
              />
              <Input
                label="Contact Phone"
                value={editForm.emergencyContactPhone}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                placeholder="Phone / Mobile"
              />
            </div>
            <div>
              <Input
                label="Emergency Contact Address"
                value={editForm.emergencyContactAddress}
                onChange={(e) => setEditForm((prev) => ({ ...prev, emergencyContactAddress: e.target.value }))}
                placeholder="Address (optional)"
              />
            </div>
          </div>

          {/* Section 5: Job Assignment */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5">
              Job Assignment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Position"
                value={editForm.position}
                onChange={(e) => setEditForm((prev) => ({ ...prev, position: e.target.value }))}
                placeholder="Job title / position"
              />
              <Input
                label="Department"
                value={editForm.department}
                onChange={(e) => setEditForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="Department"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
              disabled={updateDetailsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={updateDetailsMutation.isPending}
            >
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
