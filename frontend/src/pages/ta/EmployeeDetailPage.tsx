import { RecordBreadcrumb } from "../../components/ta/recruitment/RecordBreadcrumb";
import React, { useState } from "react";
import { useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeesApi } from "../../lib/api/employees.api";
import {
  PageHeader,
  StatusBadge,
  LoadingState,
  ErrorState,
  Tabs,
  DocumentPreviewModal,
  ActionMenu,
  ActionMenuItem,
  RecordSummary,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { EmploymentStatus, DeploymentStatus } from "../../lib/types/enums";
import { taApi } from "../../lib/api/ta.api";
import { plural } from "../../lib/plural";
import { DocumentUpdateRequestDialog } from "../../components/ta/DocumentUpdateRequestDialog";
import { RequirementReviewDialog, type RequirementReviewValues } from "../../components/ta/RequirementReviewDialog";
import { TA_COPY } from "../../lib/ta-copy";
import { notify } from "../../lib/feedback";
import { initialsOf } from "../../components/ta/workforce/initials";
import { IdentityTab } from "../../components/ta/workforce/employee/IdentityTab";
import { HistoryTab } from "../../components/ta/workforce/employee/HistoryTab";
import { DeploymentsTab } from "../../components/ta/workforce/employee/DeploymentsTab";
import { ClearanceTab } from "../../components/ta/workforce/employee/ClearanceTab";
import { EditEmployeeDialog } from "../../components/ta/workforce/employee/EditEmployeeDialog";
import { NoAccountChip } from "../../components/ta/walk-in/NoAccountChip";
import {
  ChangeStatusDialog,
  PlacementDialog,
  RecordValidityDialog,
  type ValidityStatus,
} from "../../components/ta/workforce/employee/EmployeeActionDialogs";
import type { VaultRequirement } from "../../components/ta/workforce/employee/shared";

type TabKey = "identity" | "history" | "deployments" | "compliance" | "qualifications";

const VALID_TABS: TabKey[] = ["identity", "history", "deployments", "compliance", "qualifications"];

export const EmployeeDetailPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { employeeId } = useParams({ strict: false }) as { employeeId: string };

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab") as TabKey;
      if (paramTab && VALID_TABS.includes(paramTab)) {
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [placementDialogOpen, setPlacementDialogOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<{ id: number; title: string } | null>(null);
  const [updateRequestTarget, setUpdateRequestTarget] = useState<{ id: number; label: string } | null>(null);
  const [validityTarget, setValidityTarget] = useState<{ id: number; label: string } | null>(null);
  const [validityInitial, setValidityInitial] = useState<{ validityStatus: ValidityStatus; issuedAt: string; expiresAt: string }>({
    validityStatus: "UNKNOWN",
    issuedAt: "",
    expiresAt: "",
  });
  const [reviewTarget, setReviewTarget] = useState<VaultRequirement | null>(null);

  const digital201Query = useQuery({
    queryKey: ["ta", "employee", employeeId, "201"],
    queryFn: () => (employeesApi.getEmployeeDetails ? employeesApi.getEmployeeDetails(employeeId) : employeesApi.getDigital201(employeeId)),
    enabled: Boolean(employeeId),
  });

  const reviewRequirementMutation = useMutation({
    mutationFn: ({ id, values }: { id: number; values: RequirementReviewValues }) =>
      taApi.reviewComplianceRequirement(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "employee", employeeId, "201"] });
      setReviewTarget(null);
      notify.success("Review saved", "The document status was updated.");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => notify.error("Could not save review", err?.message || err),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cand = (data.candidate?.profile ? { ...data.candidate.profile, ...data.candidate } : data.candidate || {}) as any;
  const empName = `${cand.firstName || ""} ${cand.lastName || ""}`.trim() || emp.employeeNumber;
  const deployments = data.deployments || [];
  const events = data.employmentHistory || [];
  const compliance: VaultRequirement[] = data.compliance || [];
  const followUpCount = compliance.filter((req) => req.reviewStatus !== "APPROVED").length;
  const applicantProfileIdForPlacement = data.candidate?.applicantProfileId ?? null;
  const skillsList: string[] =
    Array.isArray(data.skills) && data.skills.length > 0
      ? data.skills
      : Array.isArray(cand.skills)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? cand.skills.map((s: any) => (typeof s === "string" ? s : s.skill?.name || s.name || "")).filter(Boolean)
        : [];

  const activeDeployment = deployments.find((dep) => dep.status === DeploymentStatus.ACTIVE);
  const assignment = activeDeployment
    ? [activeDeployment.client?.name, activeDeployment.site].filter(Boolean).join(" · ") || "Client site"
    : "Not on assignment";
  const mobile = cand.mobileNumber as string | undefined;
  const email = (cand.email || emp.user?.email) as string | undefined;

  const headerFindJob = emp.status === EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT && Boolean(applicantProfileIdForPlacement);
  const headerMenuItems: ActionMenuItem[] = [
    ...(headerFindJob ? [{ label: "Edit details", onSelect: () => setEditModalOpen(true) }] : []),
    { label: "Change employment status", onSelect: () => setStatusModalOpen(true) },
  ];

  const recordValidity = (req: VaultRequirement) => {
    setValidityTarget({ id: req.id, label: req.documentLabel });
    setValidityInitial({
      validityStatus: req.expiresAt ? "HAS_EXPIRY" : req.validityStatus === "NO_EXPIRY" ? "NO_EXPIRY" : "UNKNOWN",
      issuedAt: req.issuedAt?.slice(0, 10) || "",
      expiresAt: req.expiresAt?.slice(0, 10) || "",
    });
  };

  return (
    <div className="space-y-6">
      <RecordBreadcrumb
        items={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.workforce, href: "/ta/workforce?tab=employees" },
          { label: empName },
        ]}
      />

      <RecordSummary
        titleAs="h1"
        title={empName}
        subtitle={`${emp.position || "General staff"} · ${emp.department || "Operations"}`}
        avatarText={initialsOf(empName)}
        chips={
          <>
            <StatusBadge status={emp.status} type="employment" size="sm" />
            <NoAccountChip hasPortalAccess={data.candidate?.hasPortalAccess} />
          </>
        }
        actions={
          <>
            {headerFindJob ? (
              <Button variant="primary" size="sm" onClick={() => setPlacementDialogOpen(true)}>
                {TA_COPY.workforce.actions.findJob}
              </Button>
            ) : (
              <Button variant="primary" size="sm" onClick={() => setEditModalOpen(true)}>
                Edit details
              </Button>
            )}
            <ActionMenu label="More actions for this employee" items={headerMenuItems} />
          </>
        }
        facts={[
          { label: "Employee number", value: <span className="font-mono tabular-nums">{emp.employeeNumber}</span>, copyValue: emp.employeeNumber },
          { label: "Hired", value: formatDate(emp.hireDate) },
          { label: "Mobile", value: mobile || "Not provided", copyValue: mobile || undefined, href: mobile ? `tel:${mobile}` : undefined },
          { label: "Email", value: email || "Not provided", copyValue: email || undefined, href: email ? `mailto:${email}` : undefined },
          { label: "Applicant account", value: data.candidate?.hasPortalAccess === false ? "None" : "Active" },
          { label: "Current assignment", value: assignment },
          { label: "Open follow-ups", value: followUpCount === 0 ? "None" : plural(followUpCount, "document") },
        ]}
      />

      <div className="space-y-4">
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
        />

        <div
          id={`employee-${activeTab}`}
          role="tabpanel"
          tabIndex={0}
          className="focus-ring rounded-md border border-slate-300 bg-white p-4 md:p-5"
        >
          {activeTab === "identity" && <IdentityTab candidate={cand} skills={skillsList} />}
          {activeTab === "history" && <HistoryTab events={events} />}
          {activeTab === "deployments" && (
            <DeploymentsTab deployments={deployments} employeeStatus={emp.status} employeeName={empName} />
          )}
          {activeTab === "compliance" && (
            <ClearanceTab
              compliance={compliance}
              onPreview={setPreviewDocument}
              onReview={setReviewTarget}
              onRecordValidity={recordValidity}
              onRequestUpdate={(req) => setUpdateRequestTarget({ id: req.id, label: req.documentLabel })}
            />
          )}
        </div>
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

      <ChangeStatusDialog
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        employeeId={employeeId}
        employeeName={empName}
        currentStatus={emp.status}
      />
      <RecordValidityDialog
        target={validityTarget}
        initial={validityInitial}
        onClose={() => setValidityTarget(null)}
        employeeId={employeeId}
      />
      {updateRequestTarget && (
        <DocumentUpdateRequestDialog key={updateRequestTarget.id} target={updateRequestTarget} onClose={() => setUpdateRequestTarget(null)} />
      )}
      <DocumentPreviewModal
        open={Boolean(previewDocument)}
        documentId={previewDocument?.id}
        title={previewDocument?.title}
        onClose={() => setPreviewDocument(null)}
      />
      <PlacementDialog
        open={placementDialogOpen}
        onClose={() => setPlacementDialogOpen(false)}
        employeeName={empName}
        applicantProfileId={applicantProfileIdForPlacement}
        hasPortalAccess={data.candidate?.hasPortalAccess ?? true}
      />
      <EditEmployeeDialog
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        employeeId={employeeId}
        employeeName={empName}
        candidate={cand}
        position={emp.position}
        department={emp.department}
      />
    </div>
  );
};
