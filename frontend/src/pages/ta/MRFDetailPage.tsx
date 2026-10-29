import React, { useState } from "react";
import { Link, useLocation, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import { getManilaToday, toManilaDateInput, salaryTextError, salaryRangeError, SALARY_RANGE_MESSAGE } from "../../lib/field-limits";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
  StatusBadge,
  Tabs,
  RecordSummary,
} from "../../components/common";
import { RecordBreadcrumb } from "../../components/ta/recruitment/RecordBreadcrumb";
import { MRFOverviewTab } from "../../components/ta/recruitment/mrf/MRFOverviewTab";
import { MRFLinkedJobsTab } from "../../components/ta/recruitment/mrf/MRFLinkedJobsTab";
import { MRFHistoryTab } from "../../components/ta/recruitment/mrf/MRFHistoryTab";
import { Button, Dialog, Select, ComboBox, Input, Textarea } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import { AssignmentPanel } from "../../components/ta/AssignmentPanel";
import { formatAdminPipelineStage } from "../../lib/admin-copy";
import {
  COMPLIANCE_201_PRESETS,
  REQUIREMENT_GROUPS,
  MRF_EDUCATION_OPTIONS,
  MRF_EXPERIENCE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
} from "../../lib/hr-constants";
import { ArrowLeft, Briefcase, CheckCircle2, X } from "lucide-react";
import { notify, fieldErrorsFrom } from "../../lib/feedback";
import { TA_COPY, formatTaStatus } from "../../lib/ta-copy";
import { RequirementClarityNotice } from "../../components/ta/RequirementClarityNotice";
import { FieldWarning } from "../../components/ta/FieldWarning";
import { plural } from "../../lib/plural";
import { ADMIN_REPORT_STATE_KEY, readReportReturnState } from "../../lib/admin-report-search";
import {
  LOCATION_HINT,
  LOCATION_UNCLEAR_WARNING,
  SKILLS_HINT,
  SKILLS_TRAITS_WARNING,
  locationLooksUnclear,
  skillsLookLikeTraits,
} from "../../lib/requirement-hints";
import {
  validateStandardText,
  validateProseText,
} from "../../lib/statutory-validation";

type MRFDetailTab = "overview" | "jobs" | "history";

// Manual status moves for a manpower request. Mirrors MRF_MANUAL_TRANSITIONS in backend/src/services/ta/ta.mrf.service.ts.
// CANCELLED is final for manual edits.
const MRF_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  FILLED: "Filled",
  ON_HOLD: "On hold",
  CANCELLED: "Cancelled",
};
const MRF_MANUAL_NEXT_STATUSES: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "ON_HOLD", "FILLED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "ON_HOLD", "FILLED", "CANCELLED"],
  ON_HOLD: ["OPEN", "IN_PROGRESS", "FILLED", "CANCELLED"],
  FILLED: ["OPEN", "IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  CANCELLED: [],
};

export interface MRFDetailPageProps {
  readOnly?: boolean;
  baseBackPath?: string;
}

export const MRFDetailPage: React.FC<MRFDetailPageProps> = ({
  readOnly = false,
  baseBackPath = "/ta/mrfs",
}) => {
  const queryClient = useQueryClient();
  const { mrfId } = useParams({ strict: false }) as { mrfId: string };
  const locationState: unknown = useLocation().state;
  // Opened from Admin reports: return to the same report view instead of notifications.
  const fromReport = readOnly && typeof locationState === "object" && locationState !== null && ADMIN_REPORT_STATE_KEY in locationState;
  const reportSearch = readReportReturnState(locationState);

  // null until the TA picks a tab; then the default depends on whether anyone is deployed yet.
  const [selectedTab, setActiveTab] = useState<MRFDetailTab | null>(null);
  const [linkJobModalOpen, setLinkJobModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<number>(0);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedReqs, setSelectedReqs] = useState<string[]>([]);
  const [customReqText, setCustomReqText] = useState("");
  const [deleteTemplateTarget, setDeleteTemplateTarget] = useState<{ id: number; label: string } | null>(null);

  const [editStatusModalOpen, setEditStatusModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<any>("OPEN");

  const [editDetailsModalOpen, setEditDetailsModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editHeadcount, setEditHeadcount] = useState<number | string>(1);
  const [editPriority, setEditPriority] = useState<any>("NORMAL");
  const [editTargetFillDate, setEditTargetFillDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editRequiresClientReview, setEditRequiresClientReview] = useState(true);
  const [editEmploymentType, setEditEmploymentType] = useState("Contractual");
  const [editWorkArrangement, setEditWorkArrangement] = useState("On-site");
  const [editSalaryMin, setEditSalaryMin] = useState<number | string>("");
  const [editSalaryMax, setEditSalaryMax] = useState<number | string>("");
  const [editAgeMin, setEditAgeMin] = useState<number | string>("");
  const [editAgeMax, setEditAgeMax] = useState<number | string>("");
  const [editGenderPreference, setEditGenderPreference] = useState<string>("ANY");
  const [editTattooPolicy, setEditTattooPolicy] = useState<string>("ALLOWED");
  const [editDescription, setEditDescription] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editExperience, setEditExperience] = useState("");
  const [editEducation, setEditEducation] = useState("");
  const [editCertifications, setEditCertifications] = useState("");
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const clearServerFieldError = (field: string) =>
    setServerFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleEditHeadcountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("headcount");
    setEditHeadcount(e.target.value);
  };

  const handleEditSalaryMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("salaryRangeMin");
    const val = e.target.value;
    setEditSalaryMin(val);
  };

  const handleEditSalaryMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("salaryRangeMax");
    const val = e.target.value;
    setEditSalaryMax(val);
  };

  const isEditSalaryRangeInvalid = Boolean(
    editSalaryMin !== "" &&
      editSalaryMax !== "" &&
      parseFloat(String(editSalaryMin)) > parseFloat(String(editSalaryMax))
  );

  const handleEditAgeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("ageMin");
    const val = e.target.value;
    if (val === "") {
      setEditAgeMin("");
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setEditAgeMin(val);
  };

  const handleEditAgeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearServerFieldError("ageMax");
    const val = e.target.value;
    if (val === "") {
      setEditAgeMax("");
      return;
    }
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    setEditAgeMax(val);
  };

  const isEditAgeRangeInvalid = Boolean(
    editAgeMin !== "" &&
      editAgeMax !== "" &&
      parseInt(String(editAgeMin), 10) > parseInt(String(editAgeMax), 10)
  );

  const mrfQuery = useQuery({
    queryKey: [readOnly ? "admin" : "ta", "mrf", mrfId],
    queryFn: () => (readOnly ? adminApi.getMRFDetails(mrfId) : taApi.getMRFDetails(mrfId)),
    enabled: Boolean(mrfId),
  });

  // TA default: a request with nobody deployed yet is still being sourced, so open on its job openings.
  // Everyone else starts on the overview.
  const defaultTab: MRFDetailTab =
    !readOnly && mrfQuery.data && ((mrfQuery.data.deployments as any[]) || []).length === 0 ? "jobs" : "overview";
  const activeTab: MRFDetailTab = selectedTab ?? defaultTab;

  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "all"],
    queryFn: () => taApi.listJobs(),
    enabled: !readOnly,
  });

  // Mutations
  const linkJobMutation = useMutation({
    mutationFn: (jobId: number) => taApi.linkJobToMRF(mrfId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setLinkJobModalOpen(false);
      setSelectedJobId(0);
      notify.success("Job opening linked", "The job opening is now connected to this manpower request.");
    },
    onError: (err: any) => {
      notify.error("Unable to link job opening", err);
    },
  });

  const addTemplatesBulkMutation = useMutation({
    mutationFn: (data: { documentLabels: string[]; isRequired?: boolean }) =>
      taApi.addMRFComplianceTemplatesBulk(mrfId, data),
    onSuccess: (res: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: [readOnly ? "admin" : "ta", "mrf", mrfId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setTemplateModalOpen(false);
      setSelectedReqs([]);
      setCustomReqText("");
      const count = res?.count ?? res?.data?.count ?? variables.documentLabels.length;
      notify.success(
        "Requirements added",
        `${count} document requirement${count === 1 ? "" : "s"} added to this request.`
      );
    },
    onError: (err: any) => {
      notify.error("Unable to add requirements", err);
    },
  });

  const removeTemplateMutation = useMutation({
    mutationFn: (templateId: number) => taApi.removeMRFComplianceTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ta", "mrf", mrfId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setDeleteTemplateTarget(null);
      notify.success("Requirement removed", "The document requirement was removed from this request.");
    },
    onError: (err: any) => {
      notify.error("Unable to remove requirement", err);
    },
  });

  const updateMRFMutation = useMutation({
    mutationFn: (data: any) => taApi.updateMRF(mrfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [readOnly ? "admin" : "ta", "mrf", mrfId] });
      queryClient.invalidateQueries({ queryKey: ["ta", "mrfs"] });
      setEditStatusModalOpen(false);
      setEditDetailsModalOpen(false);
      setServerFieldErrors({});
      notify.success("Manpower request updated", "The request details have been saved.");
    },
    onError: (err: any) => {
      const fieldErrors = fieldErrorsFrom(err);
      if (Object.keys(fieldErrors).length > 0) {
        setServerFieldErrors(fieldErrors);
        notify.error("Check the highlighted fields", Object.values(fieldErrors)[0]);
        return;
      }
      notify.error("Unable to update manpower request", err);
    },
  });

  const handleOpenEditDetails = () => {
    if (!mrfQuery.data) return;
    const m = mrfQuery.data;
    setEditTitle(m.title || "");
    setEditHeadcount(m.headcount || 1);
    setEditPriority(m.priority || "NORMAL");
    setEditTargetFillDate(toManilaDateInput(m.targetFillDate));
    setEditLocation(m.location || "");
    setEditEmploymentType(m.employmentType || "Contractual");
    setEditWorkArrangement(m.workArrangement || "On-site");
    setEditSalaryMin(m.salaryRangeMin != null ? m.salaryRangeMin : "");
    setEditSalaryMax(m.salaryRangeMax != null ? m.salaryRangeMax : "");
    setEditAgeMin(m.ageMin != null ? m.ageMin : "");
    setEditAgeMax(m.ageMax != null ? m.ageMax : "");
    setEditGenderPreference(m.genderPreference || "ANY");
    setEditTattooPolicy(m.tattooPolicy || "ALLOWED");
    setEditRequiresClientReview(m.requiresClientReview !== false);
    setEditDescription(m.description || "");
    setEditSkills(m.requiredSkills || "");
    setEditExperience(m.requiredExperience || "");
    setEditEducation(m.requiredEducation || "");
    setEditCertifications(m.requiredCertifications || "");
    setServerFieldErrors({});
    setEditDetailsModalOpen(true);
  };

  const handleSaveDetails = () => {
    if (!editTitle.trim()) {
      notify.error("Check the highlighted fields", "Request title is required.");
      return;
    }

    const titleErr = validateStandardText(editTitle, "Request title", { maxLength: 200 });
    if (titleErr) {
      notify.error("Check the highlighted fields", titleErr);
      return;
    }

    if (editLocation.trim()) {
      const locErr = validateStandardText(editLocation, "Location", { maxLength: 200 });
      if (locErr) {
        notify.error("Check the highlighted fields", locErr);
        return;
      }
    }

    if (editSkills.trim()) {
      const skillsErr = validateProseText(editSkills, "Required skills", { maxLength: 2000 });
      if (skillsErr) {
        notify.error("Check the highlighted fields", skillsErr);
        return;
      }
    }

    {
      const descErr = !editDescription.trim()
        ? "Describe the role and its responsibilities."
        : validateProseText(editDescription, "Job description and responsibilities", { maxLength: 10000 });
      if (descErr) {
        setServerFieldErrors((prev) => ({ ...prev, description: descErr }));
        notify.error("Check the highlighted fields", descErr);
        return;
      }
    }

    if (editCertifications.trim()) {
      const certErr = validateProseText(editCertifications, "Required certifications", { maxLength: 2000 });
      if (certErr) {
        notify.error("Check the highlighted fields", certErr);
        return;
      }
    }

    const parsedHeadcount = Number(editHeadcount);
    if (
      editHeadcount === "" || !/^\d+$/.test(String(editHeadcount)) ||
      isNaN(parsedHeadcount) ||
      !Number.isInteger(parsedHeadcount) ||
      parsedHeadcount < 1 ||
      parsedHeadcount > 1000
    ) {
      notify.error("Check the highlighted fields", "Headcount must be an integer between 1 and 1,000.");
      return;
    }

    const salaryMinText = editSalaryMin == null ? "" : String(editSalaryMin);
    const salaryMaxText = editSalaryMax == null ? "" : String(editSalaryMax);
    const salaryErrors: Record<string, string> = {};
    const minSalaryProblem = salaryTextError(salaryMinText);
    const maxSalaryProblem = salaryTextError(salaryMaxText);
    if (minSalaryProblem) salaryErrors.salaryRangeMin = minSalaryProblem;
    if (maxSalaryProblem) salaryErrors.salaryRangeMax = maxSalaryProblem;
    const rangeProblem = !minSalaryProblem && !maxSalaryProblem ? salaryRangeError(salaryMinText, salaryMaxText) : null;
    if (rangeProblem) salaryErrors.salaryRangeMax = rangeProblem;
    if (Object.keys(salaryErrors).length > 0) {
      setServerFieldErrors(salaryErrors);
      notify.error("Check the highlighted fields", Object.values(salaryErrors)[0]);
      return;
    }

    if (editAgeMin !== "" && editAgeMin != null) {
      const min = String(editAgeMin);
      if (!/^\d+$/.test(min) || Number(min) < 18 || Number(min) > 65) {
        notify.error("Check the highlighted fields", "Minimum age must be an integer between 18 and 65.");
        return;
      }
    }

    if (editAgeMax !== "" && editAgeMax != null) {
      const max = String(editAgeMax);
      if (!/^\d+$/.test(max) || Number(max) < 18 || Number(max) > 65) {
        notify.error("Check the highlighted fields", "Maximum age must be an integer between 18 and 65.");
        return;
      }
    }

    if (
      editAgeMin !== "" &&
      editAgeMin != null &&
      editAgeMax !== "" &&
      editAgeMax != null
    ) {
      if (parseInt(String(editAgeMin), 10) > parseInt(String(editAgeMax), 10)) {
        notify.error("Check the highlighted fields", "Minimum age cannot exceed maximum age.");
        return;
      }
    }

    updateMRFMutation.mutate({
      title: editTitle.trim(),
      headcount: parsedHeadcount,
      priority: editPriority,
      targetFillDate: editTargetFillDate || null,
      location: editLocation.trim() || null,
      employmentType: editEmploymentType || null,
      workArrangement: editWorkArrangement || null,
      salaryRangeMin: editSalaryMin !== "" && editSalaryMin != null ? Number(editSalaryMin) : null,
      salaryRangeMax: editSalaryMax !== "" && editSalaryMax != null ? Number(editSalaryMax) : null,
      ageMin: editAgeMin !== "" && editAgeMin != null ? Number(editAgeMin) : null,
      ageMax: editAgeMax !== "" && editAgeMax != null ? Number(editAgeMax) : null,
      genderPreference: editGenderPreference || "ANY",
      tattooPolicy: editTattooPolicy || "ALLOWED",
      requiresClientReview: editRequiresClientReview,
      description: editDescription.trim(),
      requiredSkills: editSkills.trim() || null,
      requiredExperience: editExperience.trim() || null,
      requiredEducation: editEducation.trim() || null,
      requiredCertifications: editCertifications.trim() || null,
    });
  };

  if (mrfQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={readOnly ? "Hiring request" : TA_COPY.navigation.manpowerRequests}
          description={readOnly ? "Loading hiring request details..." : "Loading request details..."}
          breadcrumbs={
            readOnly
              ? undefined
              : [
                  { label: TA_COPY.breadcrumbRoot, href: "/ta" },
                  { label: TA_COPY.navigation.manpowerRequests, href: baseBackPath },
                  { label: "Request" },
                ]
          }
        />
        <LoadingState variant="detail" />
      </div>
    );
  }

  const isNotFound =
    mrfQuery.error?.message?.toLowerCase().includes("not found") ||
    (mrfQuery.error as any)?.status === 404;

  if (isNotFound) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={readOnly ? "Hiring request not found" : "Manpower request not found"}
                description={`Request #${mrfId || "unknown"}`}
          breadcrumbs={
            readOnly
              ? [
                  { label: "Administration", href: "/admin" },
                  { label: "Notifications", href: baseBackPath },
                  { label: "Record not found" },
                ]
              : [
                  { label: TA_COPY.breadcrumbRoot, href: "/ta" },
                  { label: TA_COPY.navigation.manpowerRequests, href: baseBackPath },
                  { label: "Record not found" },
                ]
          }
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to={baseBackPath}>
                <ArrowLeft className="w-3.5 h-3.5" />
                {readOnly ? "Back to notifications" : "Back to requests"}
              </Link>
            </Button>
          }
        />
        <div className="rounded-md border border-slate-300 bg-white p-8">
          <EmptyState
            icon={<Briefcase className="w-6 h-6 text-slate-400" />}
             title={readOnly ? "This hiring request is no longer available" : "Manpower request not found"}
             description={readOnly ? "It may have been removed. Return to notifications to continue." : `Request #${mrfId} could not be found.`}
            action={
              <Button asChild variant="primary" size="sm">
                <Link to={baseBackPath}>
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {readOnly ? "Return to notifications" : "Return to requests"}
                </Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (mrfQuery.isError || !mrfQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={readOnly ? "Hiring request" : TA_COPY.navigation.manpowerRequests}
          description="Request details"
          breadcrumbs={
            readOnly
              ? undefined
              : [
                  { label: TA_COPY.breadcrumbRoot, href: "/ta" },
                  { label: TA_COPY.navigation.manpowerRequests, href: baseBackPath },
                  { label: "Request" },
                ]
          }
        />
        <ErrorState
          error={mrfQuery.error || new Error("Unable to load this manpower request")}
          onRetry={() => mrfQuery.refetch()}
        />
      </div>
    );
  }

  const mrf = mrfQuery.data;
  const jobs = jobsQuery.data || [];
  const linkedJobs = mrf.jobPostings || [];
  const templates = mrf.complianceTemplates || [];
  const deployments = (mrf.deployments as any[]) || [];
  const deployedCount = mrf.fulfillment?.deployedCount ?? deployments.length;
  const remainingCount =
    mrf.fulfillment?.remainingCount ?? Math.max(0, mrf.headcount - deployedCount);
  const isFulfilled = mrf.status === "FILLED" || Boolean(mrf.fulfillment?.isFulfilled);
  const isOverdue =
    Boolean(mrf.targetFillDate) &&
    !isFulfilled &&
    mrf.status !== "CANCELLED" &&
    new Date(mrf.targetFillDate as string).getTime() < Date.now();

  const isAlreadyAdded = (label: string) =>
    templates.some(
      (t: any) => (t.documentLabel || "").trim().toLowerCase() === label.trim().toLowerCase()
    );

  const handleAddCustomReq = () => {
    const trimmed = customReqText.trim();
    if (!trimmed) return;
    if (isAlreadyAdded(trimmed)) {
      notify.error("Already added", "This requirement is already assigned to this request.");
      return;
    }
    if (selectedReqs.some((req) => req.trim().toLowerCase() === trimmed.toLowerCase())) {
      notify.error("Already selected", "This requirement is already in your selection.");
      return;
    }
    const presetMatch = COMPLIANCE_201_PRESETS.find(
      (p) => p.label.trim().toLowerCase() === trimmed.toLowerCase()
    );
    setSelectedReqs((prev) => [...prev, presetMatch ? presetMatch.label : trimmed]);
    setCustomReqText("");
  };

  const handleRemoveSelectedReq = (label: string) => {
    setSelectedReqs((prev) => prev.filter((r) => r !== label));
  };

  const customSelectedReqs = selectedReqs.filter(
    (req) => !COMPLIANCE_201_PRESETS.some((p) => p.label.toLowerCase() === req.toLowerCase())
  );

  const cancelled = mrf.status === "CANCELLED";
  const statusLabel = formatTaStatus(readOnly ? formatAdminPipelineStage(mrf.status) : mrf.status);

  return (
    <div className="space-y-6">
      <RecordBreadcrumb
        items={
          readOnly
            ? [
                { label: "Administration", href: "/admin" },
                { label: "Notifications", href: baseBackPath },
                { label: mrf.title },
              ]
            : [
                { label: TA_COPY.breadcrumbRoot, href: "/ta" },
                { label: TA_COPY.navigation.manpowerRequests, href: baseBackPath },
                { label: mrf.title },
              ]
        }
      />

      <RecordSummary
        titleAs="h1"
        title={mrf.title}
        subtitle={readOnly ? `Request #${mrf.id} · View only` : `Request #${mrf.id}`}
        chips={<StatusBadge status={statusLabel} type="raw" />}
        progress={{ value: deployedCount, max: mrf.headcount, label: "Positions filled" }}
        facts={[
          { label: "Client", value: <span className="font-medium">{mrf.client?.name || "Client"}</span> },
          {
            label: "Target fill date",
            value: (
              <>
                <StatusBadge
                  status={mrf.targetFillDate ? formatDate(mrf.targetFillDate) : undefined}
                  type="targetDate"
                  appearance="text"
                />
                {!readOnly && isOverdue && <span className="ml-2 text-xs font-semibold text-rose-700">Overdue</span>}
              </>
            ),
          },
          { label: "Priority", value: <StatusBadge status={mrf.priority} type="priority" size="sm" appearance="text" /> },
          { label: "Remaining", value: plural(remainingCount, "position") },
          { label: "Client review", value: mrf.requiresClientReview === false ? "Not required" : "Required" },
          { label: "Created", value: formatDate(mrf.createdAt) },
        ]}
        actions={
          <>
            {readOnly && (
              <Button asChild variant="outline" size="sm">
                {fromReport ? (
                  <Link to="/admin/analytics" search={reportSearch as never}>
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to reports
                  </Link>
                ) : (
                  <Link to={baseBackPath}>
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to notifications
                  </Link>
                )}
              </Button>
            )}
            {!readOnly && (
              <>
                {!cancelled && (
                  <Button asChild variant="primary" size="sm">
                    <Link to="/ta/jobs" search={{ mrfId: mrf.id }}>
                      Create job opening
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleOpenEditDetails}>
                  Edit details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(MRF_MANUAL_NEXT_STATUSES[mrf.status] ?? []).length === 0}
                  title={(MRF_MANUAL_NEXT_STATUSES[mrf.status] ?? []).length === 0 ? "This request's status is final." : undefined}
                  onClick={() => {
                    setEditStatus(mrf.status);
                    setServerFieldErrors({});
                    setEditStatusModalOpen(true);
                  }}
                >
                  Update status
                </Button>
              </>
            )}
          </>
        }
      />

      {!readOnly && (
        <RequirementClarityNotice clarity={mrf.requirementClarity} fixHint="Use Edit details to fix them." />
      )}

      {readOnly && (
        <AssignmentPanel
          mrfId={mrf.id}
          mrfOwnerId={mrf.assignedTaId ?? null}
          clientId={mrf.client?.id ?? mrf.clientId}
          clientName={mrf.client?.name || "Client"}
          clientOwnerId={mrf.client?.assignedTaId ?? null}
        />
      )}

      {isFulfilled && (
        <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p className="text-sm">
            <strong className="font-semibold">All positions filled.</strong> The target was reached and linked job openings have been closed.
          </p>
        </div>
      )}

      <Tabs
        ariaLabel="Manpower request sections"
        value={activeTab}
        onChange={(id) => setActiveTab(id as MRFDetailTab)}
        items={[
          { id: "overview", label: "Overview", panelId: "mrf-tab-overview" },
          {
            id: "jobs",
            label: "Linked jobs",
            panelId: "mrf-tab-jobs",
            badge: { text: String(linkedJobs.length), variant: "info" },
          },
          {
            id: "history",
            label: "History",
            panelId: "mrf-tab-history",
            badge: { text: `${deployments.length} of ${mrf.headcount}`, variant: "info" },
          },
        ]}
      />

      <div className="space-y-6">
        <div role="tabpanel" id="mrf-tab-overview" aria-label="Overview" className={activeTab === "overview" ? "block" : "hidden"}>
          <MRFOverviewTab
            mrf={mrf}
            templates={templates}
            readOnly={readOnly}
            onAddDocument={() => {
              setSelectedReqs([]);
              setCustomReqText("");
              setTemplateModalOpen(true);
            }}
            onRemoveTemplate={setDeleteTemplateTarget}
          />
        </div>

        <div role="tabpanel" id="mrf-tab-jobs" aria-label="Linked jobs" className={activeTab === "jobs" ? "block" : "hidden"}>
          <MRFLinkedJobsTab
            jobs={linkedJobs}
            readOnly={readOnly}
            cancelled={cancelled}
            onLinkExisting={() => setLinkJobModalOpen(true)}
          />
        </div>

        <div role="tabpanel" id="mrf-tab-history" aria-label="History" className={activeTab === "history" ? "block" : "hidden"}>
          <MRFHistoryTab
            deployments={deployments}
            headcount={mrf.headcount}
            fallbackSite={mrf.location}
            readOnly={readOnly}
            createdAt={mrf.createdAt}
            createdByEmail={mrf.createdBy?.email}
          />
        </div>
      </div>

      {/* Modals & Dialogs (Active actions only) */}
      {!readOnly && (
        <>
          {/* Link Job Modal */}
          <Dialog
            open={linkJobModalOpen}
            onClose={() => setLinkJobModalOpen(false)}
            title="Link a job opening"
            description="Attach an active job opening to this manpower request."
            overflowVisible
            bodyClassName="min-h-[290px] flex flex-col justify-between"
          >
            <div className="space-y-4">
              <ComboBox
                label="Select job opening"
                placeholder="Search active job openings..."
                value={selectedJobId ? String(selectedJobId) : ""}
                onChange={(val) => setSelectedJobId(Number(val) || 0)}
                options={jobs.map((j) => ({
                  value: String(j.id),
                  label: j.title,
                  subtitle: `Job opening #${j.id} • ${j.location || "Philippines"}`,
                  badge: j.status,
                }))}
                emptyText="No matching job openings found"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-auto">
              <Button variant="outline" size="sm" onClick={() => setLinkJobModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedJobId}
                loading={linkJobMutation.isPending}
                onClick={() => linkJobMutation.mutate(selectedJobId)}
              >
                Link Job
              </Button>
            </div>
          </Dialog>

          {/* Add Compliance Template Modal */}
          <Dialog
            open={templateModalOpen}
            onClose={() => {
              setTemplateModalOpen(false);
              setSelectedReqs([]);
              setCustomReqText("");
            }}
            title="Add requirements"
            description="Select documents candidates must submit for this request."
            className="max-w-2xl"
            size="lg"
          >
            <div className="flex flex-col gap-4">
              <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5 text-sm">
                {REQUIREMENT_GROUPS.map((group) => {
                  const selectableItems = group.items.filter((item) => !isAlreadyAdded(item.label));
                  const isAllGroupSelected =
                    selectableItems.length > 0 &&
                    selectableItems.every((item) => selectedReqs.includes(item.label));

                  const toggleGroupSelect = () => {
                    if (isAllGroupSelected) {
                      const groupLabels = new Set(selectableItems.map((i) => i.label));
                      setSelectedReqs((prev) => prev.filter((label) => !groupLabels.has(label)));
                    } else {
                      const toAdd = selectableItems
                        .map((i) => i.label)
                        .filter((label) => !selectedReqs.includes(label));
                      setSelectedReqs((prev) => [...prev, ...toAdd]);
                    }
                  };

                  return (
                    <div key={group.id} className="space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-sm font-semibold text-slate-900">
                          {group.title} ({group.items.length})
                        </span>
                        {selectableItems.length > 0 ? (
                          <button
                            type="button"
                            onClick={toggleGroupSelect}
                            className="text-xs font-medium text-teal-700 hover:text-teal-900 transition-colors focus:outline-none focus-visible:underline"
                          >
                            {isAllGroupSelected ? "Deselect all" : "Select all"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">All added</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {group.items.map((item) => {
                          const alreadyAdded = isAlreadyAdded(item.label);
                          const isSelected = selectedReqs.includes(item.label);

                          return (
                            <label
                              key={item.label}
                              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                                alreadyAdded
                                  ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                                  : isSelected
                                  ? "bg-teal-50/50 border-teal-300 cursor-pointer"
                                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={alreadyAdded || isSelected}
                                disabled={alreadyAdded}
                                onChange={(e) => {
                                  if (alreadyAdded) return;
                                  if (e.target.checked) {
                                    setSelectedReqs((prev) => [...prev, item.label]);
                                  } else {
                                    setSelectedReqs((prev) => prev.filter((l) => l !== item.label));
                                  }
                                }}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-2 focus:ring-teal-700 focus:ring-offset-1 shrink-0 disabled:opacity-50"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-medium text-slate-900 leading-tight">
                                    {item.label}
                                  </span>
                                  {alreadyAdded && (
                                    <span className="text-xs text-slate-500 font-normal">
                                      (Already added)
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-slate-500 leading-normal mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Custom Requirement Entry */}
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div>
                    <span className="text-sm font-semibold text-slate-900">
                      Custom requirement
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Specify any role-specific certificate or document not listed above.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        type="text"
                        placeholder="Type custom requirement (e.g., Food Handler's Health Certificate)"
                        value={customReqText}
                        onChange={(e) => setCustomReqText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomReq();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={handleAddCustomReq}
                      disabled={!customReqText.trim()}
                      className="shrink-0"
                    >
                      + Add
                    </Button>
                  </div>

                  {customSelectedReqs.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-slate-700">Custom added:</span>
                      <div className="flex flex-wrap gap-2">
                        {customSelectedReqs.map((label) => (
                          <span
                            key={label}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 border border-slate-300 text-slate-800"
                          >
                            <span>{label}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSelectedReq(label)}
                              className="text-slate-500 hover:text-slate-900 focus:outline-none"
                              aria-label={`Remove ${label}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 mt-auto">
                <div className="text-xs text-slate-500">
                  {selectedReqs.length > 0 ? (
                    <span>
                      {selectedReqs.length} requirement{selectedReqs.length === 1 ? "" : "s"} selected
                    </span>
                  ) : (
                    <span>No requirements selected</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTemplateModalOpen(false);
                      setSelectedReqs([]);
                      setCustomReqText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={selectedReqs.length === 0 || addTemplatesBulkMutation.isPending}
                    loading={addTemplatesBulkMutation.isPending}
                    onClick={() =>
                      addTemplatesBulkMutation.mutate({
                        documentLabels: selectedReqs,
                        isRequired: true,
                      })
                    }
                  >
                    {selectedReqs.length === 0
                      ? "Add requirements"
                      : selectedReqs.length === 1
                      ? "Add 1 requirement"
                      : `Add ${selectedReqs.length} requirements`}
                  </Button>
                </div>
              </div>
            </div>
          </Dialog>

          {/* Edit Manpower Request Details Modal */}
          <Dialog
            open={editDetailsModalOpen}
            onClose={() => setEditDetailsModalOpen(false)}
            title="Edit manpower request"
            description="Update request order specifications, compensation, and qualifications."
            size="xl"
            overflowVisible
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveDetails();
              }}
              className="space-y-5"
            >
              {/* Section 1: Core Request Details */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
                  Request details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Request title"
                    placeholder="e.g. 50x Forklift Operators"
                    value={editTitle}
                    error={serverFieldErrors.title}
                    onChange={(e) => {
                      setEditTitle(e.target.value);
                      clearServerFieldError("title");
                    }}
                    required
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Positions needed"
                      type="number"
                      min={1}
                      max={1000}
                      value={editHeadcount}
                      error={serverFieldErrors.headcount}
                      onChange={handleEditHeadcountChange}
                      required
                    />
                    <Select
                      label="Priority"
                      value={editPriority}
                      error={serverFieldErrors.priority}
                      onChange={(e) => {
                        setEditPriority(e.target.value as any);
                        clearServerFieldError("priority");
                      }}
                      options={[
                        { value: "LOW", label: "Low" },
                        { value: "NORMAL", label: "Normal" },
                        { value: "HIGH", label: "High" },
                        { value: "URGENT", label: "Urgent" },
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Input
                      label="Work site"
                      placeholder="e.g. Calamba, Laguna"
                      helperText={LOCATION_HINT}
                      value={editLocation}
                      error={serverFieldErrors.location}
                      onChange={(e) => {
                        setEditLocation(e.target.value);
                        clearServerFieldError("location");
                      }}
                    />
                    <FieldWarning show={locationLooksUnclear(editLocation)}>{LOCATION_UNCLEAR_WARNING}</FieldWarning>
                  </div>
                  <ComboBox
                    label="Employment Type"
                    placeholder="Select employment type..."
                    value={editEmploymentType}
                    error={serverFieldErrors.employmentType}
                    onChange={(val) => {
                      setEditEmploymentType(val || "Contractual");
                      clearServerFieldError("employmentType");
                    }}
                    options={EMPLOYMENT_TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
                    allowCustom
                  />
                  <ComboBox
                    label="Work Arrangement"
                    placeholder="Select arrangement..."
                    value={editWorkArrangement}
                    error={serverFieldErrors.workArrangement}
                    onChange={(val) => {
                      setEditWorkArrangement(val || "On-site");
                      clearServerFieldError("workArrangement");
                    }}
                    options={WORK_ARRANGEMENT_OPTIONS.map((w) => ({ value: w, label: w }))}
                    allowCustom
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Target fill date"
                    type="date"
                    min={editTargetFillDate && editTargetFillDate < getManilaToday() ? editTargetFillDate : getManilaToday()}
                    value={editTargetFillDate}
                    error={serverFieldErrors.targetFillDate}
                    onChange={(e) => {
                      setEditTargetFillDate(e.target.value);
                      clearServerFieldError("targetFillDate");
                    }}
                  />
                  <Input
                    label="Minimum monthly salary (PHP)"
                    type="number"
                    min={0}
                    max={1000000}
                      step="0.01"
                    placeholder="e.g. 18000"
                    value={editSalaryMin}
                    error={serverFieldErrors.salaryRangeMin}
                    onChange={handleEditSalaryMinChange}
                  />
                  <Input
                    label="Maximum monthly salary (PHP)"
                    type="number"
                    min={0}
                    max={1000000}
                      step="0.01"
                    placeholder="e.g. 25000"
                    value={editSalaryMax}
                    onChange={handleEditSalaryMaxChange}
                    error={serverFieldErrors.salaryRangeMax || (isEditSalaryRangeInvalid ? SALARY_RANGE_MESSAGE : undefined)}
                  />
                </div>

                <Textarea
                  label="Job description and responsibilities"
                  required
                  placeholder="Describe role responsibilities..."
                  value={editDescription}
                  error={serverFieldErrors.description}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    clearServerFieldError("description");
                  }}
                  rows={3}
                  maxLength={10000}
                />
              </div>

              {/* Section 2: Skills & Qualifications */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
                  Skills and qualifications
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Input
                      label="Required skills"
                      placeholder="e.g. Forklift Operation, Heavy Machinery, Safety Certified"
                      helperText={SKILLS_HINT}
                      value={editSkills}
                      error={serverFieldErrors.requiredSkills}
                      onChange={(e) => {
                        setEditSkills(e.target.value);
                        clearServerFieldError("requiredSkills");
                      }}
                    />
                    <FieldWarning show={skillsLookLikeTraits(editSkills)}>{SKILLS_TRAITS_WARNING}</FieldWarning>
                  </div>
                  <ComboBox
                    label="Required experience"
                    placeholder="Select or specify required experience..."
                    value={editExperience}
                    error={serverFieldErrors.requiredExperience}
                    onChange={(val) => {
                      setEditExperience(val || "");
                      clearServerFieldError("requiredExperience");
                    }}
                    options={MRF_EXPERIENCE_OPTIONS.map((e) => ({ value: e, label: e }))}
                    allowCustom
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ComboBox
                    label="Minimum education"
                    placeholder="Select minimum education..."
                    value={editEducation}
                    error={serverFieldErrors.requiredEducation}
                    onChange={(val) => {
                      setEditEducation(val || "");
                      clearServerFieldError("requiredEducation");
                    }}
                    options={MRF_EDUCATION_OPTIONS.map((ed) => ({ value: ed, label: ed }))}
                  />
                  <Input
                    label="Required certifications & licenses"
                    placeholder="e.g. Professional Driver's License, TESDA NC II, PRC"
                    value={editCertifications}
                    error={serverFieldErrors.requiredCertifications}
                    onChange={(e) => {
                      setEditCertifications(e.target.value);
                      clearServerFieldError("requiredCertifications");
                    }}
                  />
                </div>
              </div>

              {/* Section 3: Demographic & Physical Qualifications */}
              <div className="space-y-3 pt-2">
                <h4 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
                  Demographic & physical qualifications
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Minimum age"
                    type="number"
                    min={18}
                    max={65}
                    placeholder="e.g. 21"
                    value={editAgeMin}
                    error={serverFieldErrors.ageMin}
                    onChange={handleEditAgeMinChange}
                    helperText="Must be between 18 and 65"
                  />
                  <Input
                    label="Maximum age"
                    type="number"
                    min={18}
                    max={65}
                    placeholder="e.g. 45"
                    value={editAgeMax}
                    onChange={handleEditAgeMaxChange}
                    error={serverFieldErrors.ageMax || (isEditAgeRangeInvalid ? "Maximum age cannot be less than minimum age" : undefined)}
                    helperText="Must be between 18 and 65"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Gender preference"
                    value={editGenderPreference}
                    error={serverFieldErrors.genderPreference}
                    onChange={(e) => {
                      setEditGenderPreference(e.target.value);
                      clearServerFieldError("genderPreference");
                    }}
                    options={[
                      { value: "ANY", label: "Any / No preference" },
                      { value: "MALE", label: "Male preferred" },
                      { value: "FEMALE", label: "Female preferred" },
                    ]}
                  />
                  <Select
                    label="Tattoo visibility policy"
                    value={editTattooPolicy}
                    error={serverFieldErrors.tattooPolicy}
                    onChange={(e) => {
                      setEditTattooPolicy(e.target.value);
                      clearServerFieldError("tattooPolicy");
                    }}
                    options={[
                      { value: "ALLOWED", label: "No restrictions / Allowed" },
                      { value: "NO_VISIBLE", label: "No visible tattoos" },
                      { value: "NONE", label: "No tattoos permitted" },
                    ]}
                  />
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <input
                      id="mrf-edit-requires-client-review"
                      type="checkbox"
                      checked={editRequiresClientReview}
                      onChange={(e) => setEditRequiresClientReview(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-slate-400 text-navy focus-ring"
                    />
                    <label htmlFor="mrf-edit-requires-client-review" className="min-w-0 text-sm text-slate-900">
                      <span className="font-medium">Requires client review</span>
                      <span className="block text-xs text-slate-600">
                        Turn this off when the client does not review candidates. Candidates go from screening straight to the final interview.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setEditDetailsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  loading={updateMRFMutation.isPending}
                >
                  Save changes
                </Button>
              </div>
            </form>
          </Dialog>

          {/* Update Status Modal */}
          <Dialog
            open={editStatusModalOpen}
            onClose={() => setEditStatusModalOpen(false)}
            title="Update request status"
            description="Choose the current status for this manpower request."
          >
            <div className="space-y-4">
              <Select
                label="Request status"
                value={editStatus}
                error={serverFieldErrors.status}
                onChange={(e) => {
                  setEditStatus(e.target.value);
                  clearServerFieldError("status");
                }}
                options={[mrf.status, ...(MRF_MANUAL_NEXT_STATUSES[mrf.status] ?? [])].map((value) => ({
                  value,
                  label: MRF_STATUS_LABELS[value] ?? value,
                }))}
              />
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setEditStatusModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  loading={updateMRFMutation.isPending}
                  onClick={() => updateMRFMutation.mutate({ status: editStatus })}
                >
                  Save status
                </Button>
              </div>
            </div>
          </Dialog>

          {/* Delete Template Confirm Dialog */}
          <ConfirmDialog
            open={Boolean(deleteTemplateTarget)}
            onClose={() => setDeleteTemplateTarget(null)}
            loading={removeTemplateMutation.isPending}
            onConfirm={() => {
              if (deleteTemplateTarget) {
                removeTemplateMutation.mutate(deleteTemplateTarget.id);
              }
            }}
            variant="danger"
            title="Remove requirement"
            description={`Remove '${deleteTemplateTarget?.label || "this requirement"}' from this manpower request?`}
            confirmLabel="Remove requirement"
          />
        </>
      )}
    </div>
  );
};

