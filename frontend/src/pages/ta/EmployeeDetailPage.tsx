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
  ActionMenuItem,
  DataTable,
  DataTableColumn,
  MaskedId,
} from "../../components/common";
import { Button, ComboBox, Dialog, Input, PhoneInput, Select, Textarea } from "../../components/ui";
import { cn, formatDate, formatDateTime } from "../../lib/utils";
import { addManilaCalendarDays, getManilaToday } from "../../lib/field-limits";
import { calculateUrgencyStatus } from "../../lib/compliance-queue";
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
import { RequirementReviewDialog, type RequirementReviewValues } from "../../components/ta/RequirementReviewDialog";
import { TA_COPY, TA_STATUS_TONE_CLASSES, getTaStatusTone } from "../../lib/ta-copy";
import { employmentEventLabel, requirementStatusLabel } from "../../lib/labels";

type TabKey =
  | "identity"
  | "history"
  | "deployments"
  | "compliance"
  | "qualifications";

const SECTION_HEADING = "text-base font-semibold text-slate-950";

const DetailField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <dt className="text-sm text-slate-600">{label}</dt>
    <dd className="text-sm text-slate-900 break-words">{children}</dd>
  </div>
);

/** One requirement status chip in the vault, worded by requirementStatusLabel. */
const RequirementBadge: React.FC<{ status?: string | null }> = ({ status }) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
      TA_STATUS_TONE_CLASSES[getTaStatusTone(status)]
    )}
  >
    {requirementStatusLabel(status)}
  </span>
);

const FollowUpTarget: React.FC<{ req: any }> = ({ req }) => {
  const targetDate = req.updateRequestDeadline || req.toFollowExpectedAt || req.deadline;
  if (!targetDate) return <span>—</span>;
  const urgency = calculateUrgencyStatus(targetDate);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{formatDate(targetDate)}</span>
      {urgency.category === "OVERDUE" && (
        <span className="rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-800">
          {urgency.label}
        </span>
      )}
      {urgency.category === "UPCOMING" && (
        <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
          {urgency.label}
        </span>
      )}
    </span>
  );
};

const ValidityDates: React.FC<{ req: any }> = ({ req }) => (
  <div className="text-sm text-slate-700">
    {req.issuedAt && <div>Issued: {formatDate(req.issuedAt)}</div>}
    {req.expiresAt && <div>Expires: {formatDate(req.expiresAt)}</div>}
    {!req.issuedAt && !req.expiresAt && <span className="text-slate-600">Not recorded</span>}
  </div>
);

const ValidityBadge: React.FC<{ req: any }> = ({ req }) =>
  req.expiresAt && req.expiresAt.slice(0, 10) < getManilaToday() ? (
    <StatusBadge status="Expired" type="raw" size="sm" />
  ) : req.expiresAt && req.expiresAt.slice(0, 10) <= addManilaCalendarDays(getManilaToday(), 30) ? (
    <StatusBadge status="Expiring soon" type="raw" size="sm" />
  ) : req.validityStatus === "UNKNOWN" && !req.expiresAt ? (
    <StatusBadge status="Validity unrecorded" type="raw" size="sm" />
  ) : req.validityStatus === "NO_EXPIRY" ? (
    <StatusBadge status="No expiry" type="raw" size="sm" />
  ) : (
    <StatusBadge status="Approved" type="raw" size="sm" />
  );

const DocumentVersions: React.FC<{ req: any; onPreview: (doc: { id: number; title: string }) => void }> = ({ req, onPreview }) =>
  req.documentVersions?.length > 1 ? (
    <details className="mt-1 text-sm">
      <summary className="focus-ring cursor-pointer text-navy hover:underline">{req.documentVersions.length} versions</summary>
      <div className="mt-1.5 space-y-1.5 border-l border-navy-line pl-2">
        {req.documentVersions.map((version: any) => (
          <div key={version.id} className="flex items-center justify-between gap-2 text-slate-700">
            <span>Uploaded {formatDate(version.uploadedAt)} · {requirementStatusLabel(version.reviewStatus)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview({ id: version.documentId, title: `${req.documentLabel} (${formatDate(version.uploadedAt)})` })}
            >
              View
            </Button>
          </div>
        ))}
      </div>
    </details>
  ) : null;


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
        // Skills now live on the identity tab; old ?tab=qualifications links still land there.
        return paramTab === "qualifications" ? "identity" : paramTab;
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

  const [reviewTarget, setReviewTarget] = useState<any | null>(null);
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

  const reviewRequirementMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: RequirementReviewValues }) =>
      taApi.reviewComplianceRequirement(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId, "201"] });
      setReviewTarget(null);
      notify.success("Review saved", "The document status was updated.");
    },
    onError: (err: any) => notify.error("Could not save review", err?.message || err),
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
      notify.success("Invitation sent", "The applicant can review and accept it from their account.");
    },
    onError: (error: any) => notify.error("Could not send invitation", error?.message || error),
  });

  if (digital201Query.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee record" description="Loading employee details..." flush />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (digital201Query.isError || !digital201Query.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee record" description="Employee details" flush />
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
  const fullAddress = [cand.address, cand.barangay, cand.city, cand.province, cand.postalCode].filter(Boolean).join(", ") || "Not provided";
  const emergencyContactInfo = cand.emergencyContactName
    ? `${cand.emergencyContactName}${cand.emergencyContactRelationship ? ` (${cand.emergencyContactRelationship})` : ""}${cand.emergencyContactPhone ? ` • ${cand.emergencyContactPhone}` : ""}`
    : "Not provided";

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

  const headerFindJob = emp.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT && Boolean(applicantProfileIdForPlacement);
  const headerMenuItems: ActionMenuItem[] = [
    ...(headerFindJob ? [{ label: "Edit details", onSelect: handleOpenEditModal }] : []),
    {
      label: "Change employment status",
      onSelect: () => {
        setNewStatus(emp.status);
        setStatusModalOpen(true);
      },
    },
  ];

  const openReview = (req: any) => setReviewTarget(req);

  const documentActions = (req: any) => (
    <div className="flex items-center justify-end gap-2">
      {req.reviewStatus === "SUBMITTED" && (
        <Button variant="primary" size="sm" onClick={() => openReview(req)}>
          Review
        </Button>
      )}
      {req.documentId ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewDocument({ id: req.documentId, title: req.documentLabel })}
        >
          View
        </Button>
      ) : (
        req.reviewStatus !== "SUBMITTED" && <span className="text-sm text-slate-600">Waiting for upload</span>
      )}
    </div>
  );

  const followUpColumns: DataTableColumn<any>[] = [
    { key: "document", header: "Document", cell: (req) => <span className="font-medium text-slate-900">{req.documentLabel}</span> },
    {
      key: "target",
      header: "Target date",
      cell: (req) => <FollowUpTarget req={req} />,
    },
    { key: "status", header: "Status", cell: (req) => <RequirementBadge status={req.reviewStatus} /> },
    { key: "action", header: "Action", align: "right", cell: documentActions },
  ];

  const verifiedColumns: DataTableColumn<any>[] = [
    {
      key: "document",
      header: "Document",
      cell: (req) => (
        <div>
          <div className="font-medium text-slate-900">{req.documentLabel}</div>
          <DocumentVersions req={req} onPreview={setPreviewDocument} />
        </div>
      ),
    },
    { key: "client", header: "Client", hideBelow: "md", cell: (req) => req.clientName || "—" },
    { key: "dates", header: "Issued and expiry", cell: (req) => <ValidityDates req={req} /> },
    { key: "status", header: "Status", cell: (req) => <ValidityBadge req={req} /> },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (req) => (
        <div className="flex items-center justify-end gap-2">
          {req.documentId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewDocument({ id: req.documentId, title: req.documentLabel })}
            >
              View
            </Button>
          )}
          {verifiedMenu(req)}
        </div>
      ),
    },
  ];

  const verifiedMenu = (req: any) => (
    <ActionMenu
      label={`More actions for ${req.documentLabel}`}
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
  );

  return (
    <div className="space-y-6">
      <PageHeader
        flush
        title={empName}
        description={`Employee no. ${emp.employeeNumber}`}
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=employees" },
          { label: emp.employeeNumber },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {headerFindJob ? (
              <Button variant="primary" size="sm" onClick={() => setPlacementDialogOpen(true)}>
                {TA_COPY.workforce.actions.findJob}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={handleOpenEditModal}>
                Edit details
              </Button>
            )}
            <ActionMenu label="More actions for this employee" items={headerMenuItems} />
          </div>
        }
      />

      <div className="space-y-4 border border-slate-300 bg-white p-4 md:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <StatusBadge status={emp.status} type="employment" size="sm" />
            </div>
            <p className="text-sm text-slate-600">
              {emp.position || "General staff"} · {emp.department || "Operations"}
            </p>
          </div>
          <p className="text-sm text-slate-700">Hired {formatDate(emp.hireDate)}</p>
        </div>

        <Tabs
          value={activeTab}
          onChange={(tab) => handleTabChange(tab as TabKey)}
          ariaLabel="Employee record sections"
          items={[
            { id: "identity", label: "Identity and IDs", panelId: "employee-identity" },
            { id: "history", label: `History (${events.length})`, panelId: "employee-history" },
            { id: "deployments", label: `Deployments (${deployments.length})`, panelId: "employee-deployments" },
            { id: "compliance", label: `Clearance vault (${compliance.length})`, panelId: "employee-compliance" },
          ]}
          className="border-b-0"
        />
      </div>

      <div id={`employee-${activeTab}`} role="tabpanel" tabIndex={0} className="focus-ring border border-slate-300 bg-white p-4 md:p-5">
        {activeTab === "identity" && (
          <div className="space-y-6">
            <section className="space-y-3" aria-labelledby="emp-ids-heading">
              <h2 id="emp-ids-heading" className={SECTION_HEADING}>Government IDs</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="SSS number"><MaskedId value={cand.sss} label="SSS number" /></DetailField>
                <DetailField label="PhilHealth PIN"><MaskedId value={cand.philhealth} label="PhilHealth PIN" /></DetailField>
                <DetailField label="Pag-IBIG MID"><MaskedId value={cand.pagibig} label="Pag-IBIG MID" /></DetailField>
                <DetailField label="TIN"><MaskedId value={cand.tin} label="TIN" /></DetailField>
              </dl>
              <p className="text-sm text-slate-600">Full numbers are shown only on request. Edit details to correct a number.</p>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="emp-personal-heading">
              <h2 id="emp-personal-heading" className={SECTION_HEADING}>Personal details</h2>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailField label="Mobile number">{cand.mobileNumber || "Not provided"}</DetailField>
                <DetailField label="Email">{cand.email || emp.user?.email || "Not provided"}</DetailField>
                <DetailField label="Residential address">{fullAddress}</DetailField>
                <DetailField label="Date of birth and gender">
                  {`${cand.dateOfBirth ? formatDate(cand.dateOfBirth) : "Not provided"}${cand.gender ? ` · ${cand.gender}` : ""}`}
                </DetailField>
                <DetailField label="Civil status">{cand.civilStatus || "Not provided"}</DetailField>
                <DetailField label="Emergency contact">{emergencyContactInfo}</DetailField>
              </dl>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-5" aria-labelledby="emp-skills-heading">
              <h2 id="emp-skills-heading" className={SECTION_HEADING}>Skills</h2>
              {skillsList.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {skillsList.map((s, idx) => (
                    <li key={idx} className="border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm text-slate-800">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No skills listed</p>
              )}
            </section>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            <h2 className={SECTION_HEADING}>Employment history</h2>
            {events.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">No employment events recorded.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((ev) => (
                  <li key={ev.id} className="space-y-1 border border-slate-200 bg-slate-50 p-3.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <span className="font-semibold text-slate-900">{employmentEventLabel(ev.eventType)}</span>
                      <span className="text-xs text-slate-600">{formatDateTime(ev.effectiveDate)}</span>
                    </div>
                    <p className="text-slate-700">{ev.description}</p>
                    {ev.actor && <p className="text-xs text-slate-600">Recorded by {ev.actor.email}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "deployments" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={SECTION_HEADING}>Deployments ({deployments.length})</h2>
              <Link
                to="/ta/workforce"
                search={{ tab: "deployments" }}
                className="focus-ring inline-flex min-h-11 items-center text-sm font-medium text-navy underline-offset-2 hover:underline md:min-h-0"
              >
                View all deployments
              </Link>
            </div>
            {deployments.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">No deployments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {deployments.map((dep) => (
                  <li key={dep.id} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900">{dep.client?.name || "Client"}</p>
                      <p className="text-sm text-slate-600">
                        {dep.site || "Client site"} · {dep.contractStart ? formatDate(dep.contractStart) : "Not set"} to {dep.contractEnd ? formatDate(dep.contractEnd) : "open"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={dep.status} employeeStatus={emp.status} type="deployment" />
                      <Button asChild variant="outline" size="sm">
                        <Link to="/ta/deployments/$deploymentId" params={{ deploymentId: String(dep.id) }}>
                          View deployment
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={SECTION_HEADING}>Clearance vault</h2>
              <span className="text-sm text-slate-700">
                {verifiedItems.length} of {compliance.length} verified
              </span>
            </div>

            {compliance.length === 0 ? (
              <p className="py-2 text-sm text-slate-600">No compliance documents attached.</p>
            ) : (
              <div className="space-y-6">
                {followUpItems.length > 0 && (
                  <section className="space-y-3" aria-labelledby="emp-followup-heading">
                    <h3 id="emp-followup-heading" className="text-sm font-semibold text-slate-900">Pending follow-up items</h3>
                    <DataTable
                      caption="Pending follow-up items"
                      columns={followUpColumns}
                      rows={followUpItems}
                      getRowId={(req: any) => String(req.id)}
                      renderCard={(req: any) => (
                        <article className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-slate-900 break-words">{req.documentLabel}</p>
                            <RequirementBadge status={req.reviewStatus} />
                          </div>
                          <p className="text-sm text-slate-600">Target date: <FollowUpTarget req={req} /></p>
                          <div className="pt-1">{documentActions(req)}</div>
                        </article>
                      )}
                    />
                  </section>
                )}

                <section className="space-y-3" aria-labelledby="emp-verified-heading">
                  <h3 id="emp-verified-heading" className="text-sm font-semibold text-slate-900">Verified documents</h3>
                  {verifiedItems.length === 0 ? (
                    <p className="py-1 text-sm text-slate-600">No verified documents on record yet.</p>
                  ) : (
                    <DataTable
                      caption="Verified documents"
                      columns={verifiedColumns}
                      rows={verifiedItems}
                      getRowId={(req: any) => String(req.id)}
                      renderCard={(req: any) => (
                        <article className="space-y-2 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 break-words">{req.documentLabel}</p>
                              {req.clientName && <p className="text-sm text-slate-600">{req.clientName}</p>}
                            </div>
                            <ValidityBadge req={req} />
                          </div>
                          <div className="text-sm text-slate-700"><ValidityDates req={req} /></div>
                          <DocumentVersions req={req} onPreview={setPreviewDocument} />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            {req.documentId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => setPreviewDocument({ id: req.documentId, title: req.documentLabel })}
                              >
                                View
                              </Button>
                            )}
                            {verifiedMenu(req)}
                          </div>
                        </article>
                      )}
                    />
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </div>

      <RequirementReviewDialog
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title="Review document"
        subtitle={reviewTarget ? `${empName} · ${reviewTarget.documentLabel}` : undefined}
        requirements={reviewTarget ? [reviewTarget] : []}
        mode="post"
        onOpenDocument={(req) => req.documentId && setPreviewDocument({ id: req.documentId, title: req.documentLabel })}
        isSubmitting={reviewRequirementMutation.isPending}
        onSubmit={(values, req) => reviewRequirementMutation.mutate({ id: req.id, values })}
      />

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

      <Dialog open={placementDialogOpen} onClose={() => setPlacementDialogOpen(false)} title={TA_COPY.workforce.actions.findJob} description={`Choose an open role to invite ${empName} to. They accept it from their applicant account.`}>
        <div className="space-y-4">
          {openJobsQuery.isError ? <ErrorState error={openJobsQuery.error} onRetry={() => openJobsQuery.refetch()} /> : (
            <ComboBox
              label="Open role"
              placeholder="Search open roles and clients"
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
            <Button variant="primary" size="sm" disabled={!targetJobId || !applicantProfileIdForPlacement} loading={inviteForPlacementMutation.isPending} onClick={() => inviteForPlacementMutation.mutate()}>{TA_COPY.workforce.actions.sendInvitation}</Button>
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
