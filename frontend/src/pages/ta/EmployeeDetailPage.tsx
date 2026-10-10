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
  DocumentPreviewModal,
  ActionMenu,
} from "../../components/common";
import { Button, ComboBox, Dialog, Input, PhoneInput, Select, Textarea } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { addManilaCalendarDays, getManilaToday, toManilaDateInput } from "../../lib/field-limits";
import { PhilippineAddressFields } from "../../components/common/PhilippineAddressFields";
import { notify } from "../../lib/feedback";
import {
  formatSSSNumber,
  formatPhilHealthNumber,
  formatPagIbigNumber,
  formatTINNumber,
  validateSSSNumber,
  validatePhilHealthNumber,
  validatePagIbigNumber,
  validateTINNumber,
  validatePhilippineContactPhone,
  validateEmergencyPhone,
  validatePersonName,
  validateStandardText,
  validateAddressText,
} from "../../lib/statutory-validation";
import { EmploymentStatus } from "../../lib/types/enums";
import { taApi } from "../../lib/api/ta.api";
import { DocumentUpdateRequestDialog } from "../../components/ta/DocumentUpdateRequestDialog";
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
function isDateBeforeToday(dateValue: string | Date | null | undefined): boolean {
  if (!dateValue) return false;
  const todayStr = getManilaToday();
  const dateStr = toManilaDateInput(typeof dateValue === "string" ? dateValue : dateValue.toISOString());
  if (dateStr) {
    return dateStr < todayStr;
  }
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

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
  const [previewDocument, setPreviewDocument] = useState<{ id: number; title: string } | null>(null);
  const [updateRequestTarget, setUpdateRequestTarget] = useState<{ id: number; label: string } | null>(null);
  const [validityTarget, setValidityTarget] = useState<{ id: number; label: string } | null>(null);
  const [validityStatus, setValidityStatus] = useState<"HAS_EXPIRY" | "NO_EXPIRY" | "UNKNOWN">("UNKNOWN");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [targetJobId, setTargetJobId] = useState("");
  const [placementMessage, setPlacementMessage] = useState("");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});
  const [editForm, setEditForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    mobileNumber: "",
    address: "",
    city: "",
    province: "",
    barangay: "",
    postalCode: "",
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
    queryFn: () => (employeesApi.getEmployeeDetails ? employeesApi.getEmployeeDetails(employeeId) : employeesApi.getDigital201(employeeId)),
    enabled: Boolean(employeeId),
  });

  const openJobsQuery = useQuery({
    queryKey: ["ta", "redeployment-open-jobs"],
    queryFn: () => taApi.listJobs({ status: "OPEN" }),
    enabled: placementDialogOpen,
  });
  const applicantProfileIdForPlacement = digital201Query.data?.candidate.applicantProfileId ?? null;

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

  const updateCredentialValidityMutation = useMutation({
    mutationFn: () => {
      if (!validityTarget) throw new Error("Select a document first.");
      return taApi.reviewComplianceRequirement(validityTarget.id, {
        reviewStatus: "APPROVED",
        validityStatus,
        issuedAt: issuedAt || null,
        expiresAt: validityStatus === "HAS_EXPIRY" ? expiresAt || null : null,
        reviewNotes: "Document validity checked in the employee Clearance Vault.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId, "201"] });
      setValidityTarget(null);
      notify.success("Document validity saved", "The verified validity information is now recorded.");
    },
    onError: (err: any) => notify.error("Could not save document validity", err?.message || err),
  });

  const inviteForPlacementMutation = useMutation({
    mutationFn: () => {
      if (!applicantProfileIdForPlacement || !targetJobId) throw new Error("Choose an open role first.");
      return taApi.sendTalentPoolInvitation({
        applicantProfileId: applicantProfileIdForPlacement,
        targetJobId: Number(targetJobId),
        message: placementMessage.trim() || "Your previous assignment has ended. Please review this opportunity and accept if you are interested.",
        expiresInDays: 7,
      });
    },
    onSuccess: () => {
      setPlacementDialogOpen(false);
      setTargetJobId("");
      setPlacementMessage("");
      notify.success("Opportunity sent", "The applicant can review and accept it from their account.");
    },
    onError: (error: any) => notify.error("Could not send opportunity", error?.message || error),
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
  const verifiedItems = compliance.filter((r: any) => r.reviewStatus === "APPROVED");
  const followUpItems = compliance.filter((r: any) => r.reviewStatus !== "APPROVED");
  const skillsList: string[] =
    Array.isArray(data.skills) && data.skills.length > 0
      ? data.skills
      : Array.isArray(cand.skills)
      ? cand.skills
          .map((s: any) => (typeof s === "string" ? s : s.skill?.name || s.name || ""))
          .filter(Boolean)
      : [];
  const fullAddress = [cand.address, cand.barangay, cand.city, cand.province, cand.postalCode].filter(Boolean).join(", ") || "N/A";
  const emergencyContactInfo = cand.emergencyContactName
    ? `${cand.emergencyContactName}${cand.emergencyContactRelationship ? ` (${cand.emergencyContactRelationship})` : ""}${cand.emergencyContactPhone ? ` • ${cand.emergencyContactPhone}` : ""}`
    : "N/A";

  const handleOpenEditModal = () => {
    setEditFormErrors({});
    setEditForm({
      firstName: cand.firstName || "",
      middleName: cand.middleName || "",
      lastName: cand.lastName || "",
      mobileNumber: cand.mobileNumber || "",
      address: cand.address || "",
      city: cand.city || "",
      province: cand.province || "",
      barangay: cand.barangay || "",
      postalCode: cand.postalCode || "",
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
    const errors: Record<string, string> = {};

    const firstErr = validatePersonName(editForm.firstName, "First Name", { required: true });
    if (firstErr) errors.firstName = firstErr;

    if (editForm.middleName.trim()) {
      const midErr = validatePersonName(editForm.middleName, "Middle Name");
      if (midErr) errors.middleName = midErr;
    }

    const lastErr = validatePersonName(editForm.lastName, "Last Name", { required: true });
    if (lastErr) errors.lastName = lastErr;

    if (editForm.address.trim()) {
      const addrErr = validateAddressText(editForm.address, "Residential Address");
      if (addrErr) errors.address = addrErr;
    }

    if (editForm.emergencyContactName.trim()) {
      const emergNameErr = validatePersonName(editForm.emergencyContactName, "Emergency Contact Name");
      if (emergNameErr) errors.emergencyContactName = emergNameErr;
    }

    if (editForm.emergencyContactRelationship.trim()) {
      const emergRelErr = validateStandardText(editForm.emergencyContactRelationship, "Emergency Contact Relationship");
      if (emergRelErr) errors.emergencyContactRelationship = emergRelErr;
    }

    if (editForm.position.trim()) {
      const posErr = validateStandardText(editForm.position, "Position");
      if (posErr) errors.position = posErr;
    }

    if (editForm.department.trim()) {
      const deptErr = validateStandardText(editForm.department, "Department");
      if (deptErr) errors.department = deptErr;
    }

    if (editForm.mobileNumber.trim()) {
      const phoneErr = validatePhilippineContactPhone(editForm.mobileNumber);
      if (phoneErr) errors.mobileNumber = phoneErr;
    }

    if (editForm.sss.trim()) {
      const sssErr = validateSSSNumber(editForm.sss);
      if (sssErr) errors.sss = sssErr;
    }

    if (editForm.philhealth.trim()) {
      const phErr = validatePhilHealthNumber(editForm.philhealth);
      if (phErr) errors.philhealth = phErr;
    }

    if (editForm.pagibig.trim()) {
      const pagibigErr = validatePagIbigNumber(editForm.pagibig);
      if (pagibigErr) errors.pagibig = pagibigErr;
    }

    if (editForm.tin.trim()) {
      const tinErr = validateTINNumber(editForm.tin);
      if (tinErr) errors.tin = tinErr;
    }

    if (editForm.emergencyContactPhone.trim()) {
      const emergPhoneErr = validateEmergencyPhone(editForm.emergencyContactPhone);
      if (emergPhoneErr) errors.emergencyContactPhone = emergPhoneErr;
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      const firstError = Object.values(errors)[0];
      notify.error("Validation error", firstError || "Please correct the highlighted fields before saving.");
      return;
    }

    setEditFormErrors({});

    updateDetailsMutation.mutate({
      firstName: editForm.firstName.trim(),
      middleName: editForm.middleName.trim() || null,
      lastName: editForm.lastName.trim(),
      mobileNumber: editForm.mobileNumber.trim() || null,
      address: editForm.address.trim() || null,
      city: editForm.city.trim() || null,
      province: editForm.province.trim() || null,
      barangay: editForm.barangay.trim() || null,
      postalCode: editForm.postalCode.trim() || null,
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
            {emp.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT && applicantProfileIdForPlacement && (
              <Button variant="primary" size="sm" onClick={() => setPlacementDialogOpen(true)}>Find placement</Button>
            )}
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
            { id: "compliance", label: `Clearance Vault (${compliance.length})`, icon: ShieldCheck, panelId: "employee-compliance" },
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
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase text-slate-500">
                201 Clearance Vault
              </h3>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                {verifiedItems.length} of {compliance.length} verified
              </span>
            </div>

            {compliance.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No compliance documents attached.</p>
            ) : (
              <div className="space-y-6">
                {followUpItems.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold uppercase text-slate-500">
                      Pending follow-up items
                    </h4>
                    <div className="divide-y divide-slate-100">
                      {followUpItems.map((req: any) => {
                        const targetDate = req.updateRequestDeadline || req.toFollowExpectedAt || req.deadline;
                        const overdue = isDateBeforeToday(targetDate);
                        return (
                          <div key={req.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900">{req.documentLabel}</div>
                              {targetDate && (
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                  <span>Target date: {formatDate(targetDate)}</span>
                                  {overdue && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                      Overdue
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {req.documentId && <Button variant="outline" size="sm" onClick={() => setPreviewDocument({ id: req.documentId, title: req.documentLabel })}>View</Button>}
                              <StatusBadge status={req.reviewStatus} type="raw" size="sm" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-500">
                    Verified 201 documents
                  </h4>
                  {verifiedItems.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No verified documents on record yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {verifiedItems.map((req: any) => (
                        <div key={req.id} className="py-3 text-xs">
                          <div className="flex items-center justify-between gap-4">
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900">{req.documentLabel}</div>
                              <div className="text-[11px] text-slate-500 font-mono">Issued: {req.issuedAt ? formatDate(req.issuedAt) : "Not recorded"}</div>
                              {req.expiresAt && <div className="text-[11px] text-slate-500 font-mono">Expires: {formatDate(req.expiresAt)}</div>}
                              {req.clientName && <div className="text-[11px] text-slate-500">Client: {req.clientName}</div>}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              {req.expiresAt && req.expiresAt.slice(0, 10) < getManilaToday() ? (
                                <StatusBadge status="Expired" type="raw" size="sm" />
                              ) : req.expiresAt && req.expiresAt.slice(0, 10) <= addManilaCalendarDays(getManilaToday(), 30) ? (
                                <StatusBadge status="Expiring soon" type="raw" size="sm" />
                              ) : req.validityStatus === "UNKNOWN" && !req.expiresAt ? (
                                <StatusBadge status="Validity unrecorded" type="raw" size="sm" />
                              ) : req.validityStatus === "NO_EXPIRY" ? (
                                <StatusBadge status="No expiry" type="raw" size="sm" />
                              ) : (
                                <StatusBadge status="Approved" type="raw" size="sm" />
                              )}
                              {req.documentId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPreviewDocument({ id: req.documentId, title: req.documentLabel })}
                                >
                                  View
                                </Button>
                              )}
                              <ActionMenu
                                label={`Actions for ${req.documentLabel}`}
                                items={[
                                  {
                                    label: "Record validity",
                                    onSelect: () => {
                                      setValidityTarget({ id: req.id, label: req.documentLabel });
                                      setValidityStatus(req.expiresAt ? "HAS_EXPIRY" : req.validityStatus === "NO_EXPIRY" ? "NO_EXPIRY" : "UNKNOWN");
                                      setIssuedAt(req.issuedAt?.slice(0, 10) || "");
                                      setExpiresAt(req.expiresAt?.slice(0, 10) || "");
                                    },
                                  },
                                  {
                                    label: "Request updated copy",
                                    onSelect: () => setUpdateRequestTarget({ id: req.id, label: req.documentLabel }),
                                  },
                                ]}
                              />
                            </div>
                          </div>
                          {req.documentVersions?.length > 1 && (
                            <details className="mt-2 text-[11px]">
                              <summary className="cursor-pointer text-teal-700">Document history ({req.documentVersions.length} versions)</summary>
                              <div className="mt-2 space-y-2 pl-2">
                                {req.documentVersions.map((version: any) => (
                                  <div key={version.id} className="flex items-center justify-between gap-2 text-slate-600">
                                    <span>Uploaded {formatDate(version.uploadedAt)} · {version.reviewStatus}{version.expiresAt ? ` · expires ${formatDate(version.expiresAt)}` : ""}</span>
                                    <Button variant="outline" size="sm" onClick={() => setPreviewDocument({ id: version.documentId, title: `${req.documentLabel} (${formatDate(version.uploadedAt)})` })}>View</Button>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

      <Dialog open={Boolean(validityTarget)} onClose={() => setValidityTarget(null)} title="Record document validity" description={validityTarget?.label}>
        <div className="space-y-4">
          <Input label="Issue date (if shown)" type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} max={getManilaToday()} />
          <Select label="Validity" value={validityStatus} onChange={(event) => setValidityStatus(event.target.value as typeof validityStatus)} options={[
            { value: "UNKNOWN", label: "Not verified" },
            { value: "HAS_EXPIRY", label: "Has an expiry date" },
            { value: "NO_EXPIRY", label: "No expiry shown" },
          ]} />
          {validityStatus === "HAS_EXPIRY" && <Input label="Expiry date" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} required />}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setValidityTarget(null)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={validityStatus === "HAS_EXPIRY" && !expiresAt} loading={updateCredentialValidityMutation.isPending} onClick={() => updateCredentialValidityMutation.mutate()}>Save validity</Button>
          </div>
        </div>
      </Dialog>
      {updateRequestTarget && <DocumentUpdateRequestDialog key={updateRequestTarget.id} target={updateRequestTarget} onClose={() => setUpdateRequestTarget(null)} />}
      <DocumentPreviewModal open={Boolean(previewDocument)} documentId={previewDocument?.id} title={previewDocument?.title} onClose={() => setPreviewDocument(null)} />

      <Dialog open={placementDialogOpen} onClose={() => setPlacementDialogOpen(false)} title="Find a placement" description={`Send an open role to ${empName}. They can accept it in their Applicant account.`}>
        <div className="space-y-4">
          {openJobsQuery.isError ? <ErrorState error={openJobsQuery.error} onRetry={() => openJobsQuery.refetch()} /> : (
            <ComboBox
              label="Open role"
              placeholder="Search open roles and clients..."
              value={targetJobId}
              options={(openJobsQuery.data || []).map((job: any) => ({
                value: String(job.id),
                label: job.title,
                subtitle: job.mrf?.client?.name || "Client not assigned",
              }))}
              onChange={(value) => setTargetJobId(value)}
            />
          )}
          <Textarea label="Message (optional)" value={placementMessage} onChange={(event) => setPlacementMessage(event.target.value)} rows={3} placeholder="Add a short note about the role or work site." />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button variant="outline" size="sm" onClick={() => setPlacementDialogOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!targetJobId || !applicantProfileIdForPlacement} loading={inviteForPlacementMutation.isPending} onClick={() => inviteForPlacementMutation.mutate()}>Send opportunity</Button>
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
                nameInput
                required
                maxLength={100}
                value={editForm.firstName}
                error={editFormErrors.firstName}
                onChange={(e) => {
                  setEditForm((prev) => ({ ...prev, firstName: e.target.value }));
                  if (editFormErrors.firstName) setEditFormErrors((err) => ({ ...err, firstName: "" }));
                }}
                placeholder="First name"
              />
              <Input
                label="Middle Name"
                nameInput
                maxLength={100}
                value={editForm.middleName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, middleName: e.target.value }))}
                placeholder="Middle name (optional)"
              />
              <Input
                label="Last Name"
                nameInput
                required
                maxLength={100}
                value={editForm.lastName}
                error={editFormErrors.lastName}
                onChange={(e) => {
                  setEditForm((prev) => ({ ...prev, lastName: e.target.value }));
                  if (editFormErrors.lastName) setEditFormErrors((err) => ({ ...err, lastName: "" }));
                }}
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
              <PhoneInput
                label="Contact Mobile"
                value={editForm.mobileNumber}
                mobileOnly
                error={editFormErrors.mobileNumber}
                onChange={(value) => {
                  setEditForm((prev) => ({ ...prev, mobileNumber: value }));
                  if (editFormErrors.mobileNumber) setEditFormErrors((err) => ({ ...err, mobileNumber: "" }));
                }}
                placeholder="0917-123-4567"
                helperText="e.g. 0917-123-4567"
              />
            </div>
            <div>
              <Input
                label="Residential Address"
                maxLength={500}
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Street address, building, or barangay"
              />
            </div>
            <PhilippineAddressFields
              province={editForm.province}
              city={editForm.city}
              barangay={editForm.barangay}
              postalCode={editForm.postalCode}
              onChange={(patch) => setEditForm((previous) => ({ ...previous, ...patch }))}
            />
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
                maxLength={12}
                inputMode="numeric"
                error={editFormErrors.sss}
                onChange={(e) => {
                  const val = formatSSSNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, sss: val }));
                  if (editFormErrors.sss) setEditFormErrors((err) => ({ ...err, sss: "" }));
                }}
                placeholder="01-2345678-9"
                helperText="e.g. 01-2345678-9 (10 digits)"
              />
              <Input
                label="PhilHealth PIN"
                value={editForm.philhealth}
                maxLength={14}
                inputMode="numeric"
                error={editFormErrors.philhealth}
                onChange={(e) => {
                  const val = formatPhilHealthNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, philhealth: val }));
                  if (editFormErrors.philhealth) setEditFormErrors((err) => ({ ...err, philhealth: "" }));
                }}
                placeholder="01-234567890-1"
                helperText="e.g. 01-234567890-1 (12 digits)"
              />
              <Input
                label="Pag-IBIG MID"
                value={editForm.pagibig}
                maxLength={14}
                inputMode="numeric"
                error={editFormErrors.pagibig}
                onChange={(e) => {
                  const val = formatPagIbigNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, pagibig: val }));
                  if (editFormErrors.pagibig) setEditFormErrors((err) => ({ ...err, pagibig: "" }));
                }}
                placeholder="1234-5678-9012"
                helperText="e.g. 1234-5678-9012 (12 digits)"
              />
              <Input
                label="TIN Number"
                value={editForm.tin}
                maxLength={15}
                inputMode="numeric"
                error={editFormErrors.tin}
                onChange={(e) => {
                  const val = formatTINNumber(e.target.value);
                  setEditForm((prev) => ({ ...prev, tin: val }));
                  if (editFormErrors.tin) setEditFormErrors((err) => ({ ...err, tin: "" }));
                }}
                placeholder="123-456-789-000"
                helperText="e.g. 123-456-789-000 (9 or 12 digits)"
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
                nameInput
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
              <PhoneInput
                label="Contact Phone"
                value={editForm.emergencyContactPhone}
                mobileOnly
                error={editFormErrors.emergencyContactPhone}
                onChange={(val) => {
                  setEditForm((prev) => ({ ...prev, emergencyContactPhone: val }));
                  if (editFormErrors.emergencyContactPhone) setEditFormErrors((err) => ({ ...err, emergencyContactPhone: "" }));
                }}
                placeholder="0917-123-4567"
                helperText="e.g. 0917-123-4567"
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
