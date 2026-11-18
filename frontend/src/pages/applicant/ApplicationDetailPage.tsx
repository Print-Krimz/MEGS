import { VenueMap } from "../../components/applicant/VenueMap";
import React, { useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  StatusBadge,
  PipelineIndicator,
  LoadingState,
  ErrorState,
  DocumentPreviewModal,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { BackoutDialog } from "../../components/ta/BackoutDialog";
import { canApplicantWithdraw } from "../../lib/backout";
import { getPipelineStageIndex } from "../../lib/pipeline-stages";
import {
  formatDate,
  formatDateTime,
  formatEmploymentType,
  formatSalaryRange,
  formatWorkArrangement,
  getApplicationStatusPresentation,
} from "../../lib/utils";
import { formatWorkSchedule } from "../../lib/mrf-schedule";
import { firstParagraph } from "./components/JobCard";
import { APPLICANT_NEXT_STEP } from "../../lib/labels";
import { requirementSubmission } from "../../lib/requirementSubmission";
import {
  Briefcase,
  Building2,
  Calendar,
  MapPin,
  FileCheck2,
  Clock,
  Upload,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  Check,
  X,
  FileText,
  Library,
  Camera,
} from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";
import type { ComplianceRequirement, RescheduleActivity } from "../../lib/types/application.types";
import { RescheduleControl, RescheduleRequestDialog } from "../../components/applicant/RescheduleRequest";
import { RequirementStatusBadge, REQUIREMENT_STATUS_LABEL } from "../../components/applicant/RequirementStatusBadge";
import { notify } from "../../lib/feedback";
import { isTouchDevice, shrinkImage } from "../../lib/camera-capture";
import { getApplicationRefetchInterval } from "../../lib/query-policies";
import { useLiveStreamConnected } from "../../lib/live-stream-status";
import { addManilaCalendarDays, getManilaToday, toManilaDateInput } from "../../lib/field-limits";

const normalizeDocumentLabel = (value: string) => value.trim().toLowerCase();

type RequirementRef = Pick<ComplianceRequirement, "id" | "documentId" | "documentLabel" | "reviewStatus">;

const sentenceCase = (value: string) => {
  const text = value.replace(/_/g, " ").trim().toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const stripInlineMarkdown = (value: string) =>
  value
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,!?;:])/g, "$1$2");

// Interview result chip: same shape and colours as the other applicant badges.
const RESULT_CHIP = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

class FileTooLargeError extends Error {}

// Same document types the backend accepts (upload.middleware.ts), so the file picker and the check agree.
const COMPLIANCE_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };
  const queryClient = useQueryClient();
  const [activeUploadReqId, setActiveUploadReqId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    title?: string;
    requirementStatus?: string;
  } | null>(null);
  const [reuseTarget, setReuseTarget] = useState<RequirementRef | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [rescheduleActivity, setRescheduleActivity] = useState<RescheduleActivity | null>(null);

  const streamConnected = useLiveStreamConnected();
  const applicationQuery = useQuery({
    queryKey: ["applicant", "application", applicationId],
    queryFn: ({ signal }) => applicantJobsApi.getApplicationDetail(applicationId, { signal }),
    enabled: Boolean(applicationId),
    refetchInterval: (query) => getApplicationRefetchInterval(query.state.data, streamConnected),
    refetchOnWindowFocus: true,
  });

  // The library is only needed while this application still has requirements that are not approved.
  const hasOpenRequirements = (applicationQuery.data?.complianceRequirements || []).some(
    (req) => req.reviewStatus !== "APPROVED",
  );
  const libraryQuery = useQuery({
    queryKey: ["applicant", "my-document-library"],
    queryFn: () => applicantJobsApi.getMyDocumentLibrary(),
    enabled: hasOpenRequirements,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ requirementId, file }: { requirementId: number; file: File }) => {
      // Resizing a phone photo takes a moment; doing it here keeps the button in its pending state meanwhile.
      const prepared = await shrinkImage(file);
      if (prepared.size > MAX_UPLOAD_BYTES) {
        throw new FileTooLargeError("Maximum upload size is 5 MB. Please select a smaller file.");
      }
      return applicantJobsApi.uploadComplianceDocument(requirementId, prepared);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      notify.success("Document Uploaded", "Document uploaded successfully and submitted for recruiter verification.");
      setActiveUploadReqId(null);
    },
    onError: (err: any) => {
      if (err instanceof FileTooLargeError) {
        notify.error("File Too Large", err.message);
      } else {
        notify.error("Upload Failed", err);
      }
      setActiveUploadReqId(null);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (data: { reason: string; notes?: string }) => applicantJobsApi.withdrawApplication(applicationId, data),
    onSuccess: () => {
      setWithdrawOpen(false);
      notify.success("Application withdrawn");
      queryClient.invalidateQueries({ queryKey: ["applicant", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "active-deployment"] });
    },
    onError: (err) => notify.error("Unable to withdraw application", err),
  });

  const rescheduleMutation = useMutation({
    mutationFn: (data: { activity: RescheduleActivity; reason: string; proposedAt?: string }) => applicantJobsApi.requestReschedule(applicationId, data),
    onSuccess: () => {
      setRescheduleActivity(null);
      queryClient.invalidateQueries({ queryKey: ["applicant", "application", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["applicant", "my-applications"] });
      notify.success("Request sent", "Your recruiter will review your request and reply.");
    },
    onError: (err) => notify.error("Unable to send your request", err),
  });

  const reuseMutation = useMutation({
    mutationFn: ({ requirementId, documentId }: { requirementId: number; documentId: number }) =>
      applicantJobsApi.reuseComplianceDocument(requirementId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      notify.success("Document Reused", "Document added to this requirement and submitted for recruiter verification.");
      setReuseTarget(null);
    },
    onError: (err: any) => {
      notify.error("Unable to Use Document", err);
      setReuseTarget(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    // reset input so the same file or a new photo can be chosen again
    e.target.value = "";
    if (!picked || !activeUploadReqId) return;
    if (!COMPLIANCE_UPLOAD_TYPES.includes(picked.type)) {
      notify.error("Unsupported File Type", "Upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file.");
      return;
    }
    uploadMutation.mutate({ requirementId: activeUploadReqId, file: picked });
  };

  // Library entries for the same document type, from a different requirement, that have not expired.
  const libraryMatchesFor = (req: RequirementRef) => {
    const key = normalizeDocumentLabel(req.documentLabel);
    return (libraryQuery.data || []).filter(
      (entry) =>
        !entry.isExpired &&
        entry.reviewStatus !== "REJECTED" &&
        entry.requirementId !== req.id &&
        entry.documentId !== req.documentId &&
        normalizeDocumentLabel(entry.label) === key,
    );
  };

  const renderLibraryAction = (req: RequirementRef) => {
    if (req.reviewStatus === "APPROVED" || libraryMatchesFor(req).length === 0) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={uploadMutation.isPending || reuseMutation.isPending}
        leftIcon={<Library className="w-3.5 h-3.5" />}
        className="col-span-2 sm:col-span-1"
        onClick={() => setReuseTarget(req)}
      >
        Use a document from my library
      </Button>
    );
  };

  const renderViewButton = (req: RequirementRef) =>
    req.documentId ? (
      <Button
        variant="outline"
        size="sm"
        aria-label={`View ${req.documentLabel}`}
        leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
        onClick={() =>
          setPreviewDocState({
            open: true,
            documentId: req.documentId,
            title: req.documentLabel,
            requirementStatus: req.reviewStatus,
          })
        }
      >
        View
      </Button>
    ) : null;

  const renderCameraAction = (req: RequirementRef, allowApproved = false) => {
    if (!isTouchDevice() || (!allowApproved && req.reviewStatus === "APPROVED")) return null;
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={uploadMutation.isPending}
        leftIcon={<Camera className="w-3.5 h-3.5" />}
        onClick={() => {
          setActiveUploadReqId(req.id);
          cameraInputRef.current?.click();
        }}
      >
        Take photo
      </Button>
    );
  };

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application details"
          description="Loading your application…"
          breadcrumbs={[
            { label: "My career", href: "/app" },
            { label: "My Applications", href: "/app/applications" },
            { label: "Application Details" },
          ]}
        />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    // A 404 means this application is not here (or not yours); retrying cannot help.
    const notFound = (applicationQuery.error as { status?: number } | null)?.status === 404;
    // Offline, TanStack pauses the fetch and the query stays pending: say so instead of "not found".
    const offline = applicationQuery.fetchStatus === "paused" && !applicationQuery.isError && !applicationQuery.data;
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application details"
          description="Application progress"
          breadcrumbs={[
            { label: "My career", href: "/app" },
            { label: "My Applications", href: "/app/applications" },
            { label: "Application Details" },
          ]}
        />
        {applicationQuery.isError && !notFound ? (
          <ErrorState
            subject="application"
            error={applicationQuery.error}
            onRetry={() => applicationQuery.refetch()}
          />
        ) : offline ? (
          <ErrorState subject="application" onRetry={() => applicationQuery.refetch()} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4">
            <p className="text-sm text-[#486581]">
              This application does not exist or you do not have permission to view it.
            </p>
            <Button asChild variant="outline">
              <Link to="/app/applications">Back to applications</Link>
            </Button>
          </div>
        )}
      </div>
    );
  }

  const application = applicationQuery.data;
  // An archived application has no next step to show.
  const nextStep = application.isArchived ? undefined : APPLICANT_NEXT_STEP[application.status];
  const job = application.jobPosting;
  const interviews = application.interviews || [];
  const compliance = application.complianceRequirements || [];
  const isDeployed = application.status === ApplicationStatus.DEPLOYED;
  const latestDeployment = application.deployments?.[0];
  const assignmentEnded = isDeployed && latestDeployment?.status === "ENDED";
  const pendingFollowUps = compliance.filter((c) => c.reviewStatus !== "APPROVED");
  const approvedClearances = compliance.filter((c) => c.reviewStatus === "APPROVED");
  const stageIndex = getPipelineStageIndex(application.status);
  const requirementsFirst = application.status === ApplicationStatus.COMPLIANCE;
  // Once the requirements stage starts, an empty interviews card only adds a dead-end message.
  const hideInterviews = interviews.length === 0 && stageIndex >= getPipelineStageIndex(ApplicationStatus.COMPLIANCE);

  const renderRequirementRow = (req: ComplianceRequirement) => {
    const isApproved = req.reviewStatus === "APPROVED";
    const isRejected = req.reviewStatus === "REJECTED";
    const expiryDay = req.expiresAt ? toManilaDateInput(req.expiresAt) : null;
    const expired = expiryDay !== null && expiryDay < getManilaToday();
    const expiresSoon = isApproved && expiryDay !== null && expiryDay <= addManilaCalendarDays(getManilaToday(), 30);
    // The backend only replaces an approved document while a TA update request is open (deployed placements), so the replace actions are deployed-only.
    const canReplaceApproved = isDeployed && expiresSoon;
    const { submittedAt } = requirementSubmission(req.documentVersions, req.reviewStatus);
    const targetDate = req.updateRequestDeadline || req.toFollowExpectedAt || req.deadline;
    const rejectionNote =
      req.reviewNotes || (isDeployed ? null : "Please review document requirements and re-upload a clear and valid copy.");

    return (
      <div key={req.id} className="p-4 space-y-2 hover:bg-[#F7F9FC] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <span className="block break-words text-sm font-semibold text-[#102A43]">
              {req.documentLabel}
            </span>
            {isDeployed ? (
              !isApproved &&
              targetDate && (
                <div className="text-xs text-[#486581]">Target date: {formatDate(targetDate)}</div>
              )
            ) : (
              <>
                {req.deadline && (
                  <div className="text-xs text-[#486581]">Deadline: {formatDate(req.deadline)}</div>
                )}
                {req.reviewStatus === "TO_FOLLOW" && req.toFollowExpectedAt && (
                  <div className="text-xs text-[#486581]">
                    Expected by {formatDate(req.toFollowExpectedAt)}
                  </div>
                )}
                {submittedAt && <div className="text-xs text-[#486581]">Submitted {formatDate(submittedAt)}</div>}
              </>
            )}
          </div>
          <div className="shrink-0">
            <RequirementStatusBadge status={req.reviewStatus} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2 empty:hidden sm:flex sm:flex-wrap sm:items-center">
          {renderViewButton(req)}

          {(!isApproved || canReplaceApproved) && (
            <Button
              variant={isRejected ? "primary" : "outline"}
              size="sm"
              disabled={uploadMutation.isPending}
              loading={uploadMutation.isPending && activeUploadReqId === req.id}
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => {
                setActiveUploadReqId(req.id);
                fileInputRef.current?.click();
              }}
            >
              {isApproved ? "Upload new copy" : req.documentId ? "Replace File" : "Upload File"}
            </Button>
          )}

          {renderCameraAction(req, canReplaceApproved)}
          {renderLibraryAction(req)}
        </div>

        {isRejected && rejectionNote && (
          <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded-md text-sm text-[#B91C1C] space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Document Rejected by Recruiter
            </div>
            <p className="pl-5">{rejectionNote}</p>
          </div>
        )}

        {isApproved && req.expiresAt && (
          <div className={`text-xs ${expired ? "text-[#B91C1C]" : expiresSoon ? "text-[#B45309]" : "text-[#486581]"}`}>
            {expired ? "Expired · " : expiresSoon ? "Expiring soon · " : ""}Expires {formatDate(req.expiresAt)}
          </div>
        )}
      </div>
    );
  };

  const interviewsCard = hideInterviews ? null : (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-3.5 border-b border-slate-200 flex items-center gap-2 bg-slate-50/70">
        <Calendar className="w-4 h-4 text-[#0B315D]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[#102A43]">
          Interviews and assessments
        </h2>
      </div>

      {interviews.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#486581]">
          No interviews scheduled yet. Once our recruitment team reviews your application, interview details will appear here.
        </div>
      ) : (
        <div className="divide-y divide-slate-200 p-4 space-y-3">
          {interviews.map((interview) => {
            const isPassed = interview.result === "PASS" || interview.result === "PASSED";
            const isFailed = interview.result === "FAIL" || interview.result === "FAILED";
            const isNoShow = interview.result === "NO_SHOW";

            return (
              <div key={interview.id} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold text-[#102A43]">
                    {sentenceCase(interview.type)}
                  </span>
                  {isPassed ? (
                    <span className={`${RESULT_CHIP} bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]`}>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" /> Pass
                    </span>
                  ) : isFailed ? (
                    <span className={`${RESULT_CHIP} bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]`}>
                      <X className="w-3.5 h-3.5" aria-hidden="true" /> Not passed
                    </span>
                  ) : isNoShow ? (
                    <span className={`${RESULT_CHIP} bg-[#F7F9FC] text-[#486581] border-[#D9E2EC]`}>No show</span>
                  ) : (
                    <span className={`${RESULT_CHIP} bg-[#EAF0F7] text-[#0B315D] border-[#D9E2EC]`}>
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Scheduled
                    </span>
                  )}
                </div>

                <div className="text-xs text-[#486581] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#486581]" aria-hidden="true" />
                  <span>{formatDateTime(interview.scheduledAt || interview.createdAt)}</span>
                </div>

                {interview.location && (
                  <div className="text-xs text-[#486581] flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[#486581] shrink-0" aria-hidden="true" />
                    <span className="break-words">{interview.location}</span>
                  </div>
                )}

                {application.source !== "WALK_IN" &&
                  (!interview.result || interview.result === "PENDING" || interview.result === "SCHEDULED") && (
                  <RescheduleControl
                    activity={interview.type}
                    interviewId={interview.id}
                    scheduledAt={interview.scheduledAt}
                    requests={application.rescheduleRequests}
                    onRequest={setRescheduleActivity}
                  />
                )}

                {interview.notes && (
                  <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B315D]">
                      <FileText className="w-3.5 h-3.5 text-[#0B315D]" aria-hidden="true" />
                      <span>Evaluation &amp; Interview Notes</span>
                    </div>
                    <p className="text-sm text-[#102A43] font-medium leading-relaxed pl-2.5 border-l-2 border-[#0B315D]">
                      {interview.notes}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const requirementsCard = isDeployed ? (
    <div className="space-y-6">
      {compliance.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#0B315D]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#102A43]">
                Requirements
              </h2>
            </div>
          </div>
          <div className="p-6 text-center text-sm text-[#486581]">
            No active document requirements are assigned yet.
          </div>
        </div>
      )}

      {/* Requirements to follow up (Action needed) */}
      {pendingFollowUps.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-[#FDE68A] flex items-center justify-between bg-[#FFFBEB]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#92400E]">
                Requirements to follow up (Action needed)
              </h2>
            </div>
            <span className="text-xs font-medium text-[#B45309]">
              {pendingFollowUps.length} pending
            </span>
          </div>

          <div className="divide-y divide-slate-200">{pendingFollowUps.map(renderRequirementRow)}</div>
        </div>
      )}

      {/* Verified 201 clearances */}
      {approvedClearances.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#047857]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#102A43]">
                Verified 201 clearances
              </h2>
            </div>
            <span className="text-xs font-medium text-[#047857]">
              {approvedClearances.length} verified
            </span>
          </div>

          <div className="divide-y divide-slate-200">{approvedClearances.map(renderRequirementRow)}</div>
        </div>
      )}
    </div>
  ) : (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-[#0B315D]" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-[#102A43]">
            Requirements
          </h2>
        </div>
        <span className="text-xs text-[#486581]">
          {approvedClearances.length} / {compliance.length} Approved
        </span>
      </div>

      {compliance.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#486581]">
          {(application.status === ApplicationStatus.CONTRACT_SIGNING || application.status === ApplicationStatus.ONBOARDING)
            ? "No additional requirements are pending. Contract signing is the next step."
            : "No active document requirements are assigned yet. We’ll show them here when they are ready."}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">{compliance.map(renderRequirementRow)}</div>
      )}
    </div>
  );

  const worksite = job?.location?.trim() || job?.mrf?.location?.trim() || null;
  const employmentTerms = [
    job?.mrf?.employmentType ? formatEmploymentType(job.mrf.employmentType) : null,
    job?.mrf?.workArrangement ? formatWorkArrangement(job.mrf.workArrangement) : null,
    job?.mrf?.department || null,
  ].filter(Boolean) as string[];
  const workSchedule = job?.mrf ? formatWorkSchedule(job.mrf) : null;
  const hasSalary = Boolean((job?.mrf?.salaryRangeMin ?? 0) > 0 || (job?.mrf?.salaryRangeMax ?? 0) > 0);
  const salaryDisplay = hasSalary ? formatSalaryRange(job?.mrf?.salaryRangeMin, job?.mrf?.salaryRangeMax) : null;
  const rawParagraph = firstParagraph(job?.description);
  const roleSummary = rawParagraph ? stripInlineMarkdown(rawParagraph) : "";


  return (
    <div className="min-w-0 space-y-6">
      {/* Hidden file input for document uploading */}
      <input
        ref={fileInputRef}
        type="file"
        accept={COMPLIANCE_UPLOAD_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />
      {/* Hidden camera input: opens the phone's rear camera directly */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <PageHeader
        title={job?.title || "Application Details"}
        description="Follow your application progress and upcoming steps."
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "My Applications", href: "/app/applications" },
          { label: job?.title || "Application Details" },
        ]}
        actions={
          <Button asChild variant="outline">
            <Link to="/app/applications">Back to applications</Link>
          </Button>
        }
      />

      {/* Progress Card */}
      <div className="min-w-0 bg-white border border-slate-200 rounded-xl p-5 space-y-4 [overflow-wrap:anywhere]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-[#486581]">
                Current status
              </span>
              {assignmentEnded ? (
                <span className="inline-flex items-center rounded-md border border-[#D9E2EC] bg-[#F7F9FC] px-2 py-0.5 text-xs font-medium text-[#486581]">
                  Assignment ended
                </span>
              ) : (
                <StatusBadge status={application.status} audience="applicant" size="sm" />
              )}
            </div>
            <div className="text-sm text-[#486581]">
              Submitted on {formatDate(application.createdAt)}
            </div>
            {nextStep && <p className="text-sm text-[#486581]">{nextStep}</p>}
          </div>
        </div>

        {/* Supporting message for Future Opportunities */}
        {application.status === ApplicationStatus.TALENT_POOL && (
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#0B315D] shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#102A43]">
                Future opportunities
              </h2>
            </div>
            <p className="text-sm text-[#486581] leading-relaxed">
              You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.
            </p>
          </div>
        )}

        {(application.status === ApplicationStatus.CONTRACT_SIGNING || application.status === ApplicationStatus.ONBOARDING) && (
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
            <h2 className="text-sm font-semibold text-[#102A43]">Pre-employment documents approved</h2>
            {application.contractSigningAt ? (
              <>
                <p className="text-sm text-[#102A43] leading-relaxed">
                  Contract signing: <span className="font-semibold">{formatDateTime(application.contractSigningAt)}</span>
                  {application.contractSigningLocation ? ` at ${application.contractSigningLocation}` : ""}
                </p>
                <VenueMap location={application.contractSigningLocation} />
                {application.source !== "WALK_IN" && (
                  <div className="pt-1">
                    <RescheduleControl
                      activity="CONTRACT_SIGNING"
                      scheduledAt={application.contractSigningAt}
                      requests={application.rescheduleRequests}
                      onRequest={setRescheduleActivity}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-[#486581] leading-relaxed">
                Your TA will contact you to sign your employment contract. Check your email for updates.
              </p>
            )}
          </div>
        )}

        {assignmentEnded && (
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
            <h2 className="text-sm font-semibold text-[#102A43]">Assignment ended</h2>
            <p className="text-sm text-[#486581] leading-relaxed">
              {latestDeployment?.actualEnd ? `Your assignment ended on ${formatDate(latestDeployment.actualEnd)}. ` : "Your assignment has ended. "}
              Your TA will contact you about your next opportunity.
            </p>
          </div>
        )}

        {isDeployed && !assignmentEnded && (
          pendingFollowUps.length > 0 ? (
            <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-[#92400E]">
                    Deployed to work site - Follow-up requirements pending
                  </h2>
                </div>
                <span className="inline-flex items-center rounded-md border border-[#FED7AA] bg-white px-2 py-0.5 text-xs font-medium text-[#B45309] self-start sm:self-auto">
                  {pendingFollowUps.length} requirement(s) pending follow-up
                </span>
              </div>
              <p className="text-sm text-[#78350F] leading-relaxed">
                You are actively deployed. Upload your remaining requirements once available.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[#047857]">
                  Deployed to work site - 100% Compliant
                </h2>
              </div>
              <p className="text-sm text-[#102A43] leading-relaxed">
                All pre-employment and post-deployment requirements are verified. Your 201 file is complete.
              </p>
            </div>
          )
        )}

        {/* Narrow screens get "Step N of 7: <stage>" plus a bar. The full stepper starts at md: at 640 px "Requirements" no longer fits its column and breaks. */}
        <div className="py-1 md:hidden">
          <PipelineIndicator
            variant="compact"
            currentStatus={application.status}
            currentLabel={getApplicationStatusPresentation(application.status, "applicant").label}
            audience="applicant"
            hideTerminalAlert
            skipClientReview={application.jobPosting?.mrf?.requiresClientReview === false}
            // Depends on the compact variant markup in PipelineIndicator: its root has a direct div ("Step N of 7" block) and an ol (the steps).
            className="[&>div]:block! [&>ol]:hidden"
          />
        </div>
        <div className="hidden py-1 md:block">
          <PipelineIndicator
            currentStatus={application.status}
            audience="applicant"
            hideTerminalAlert
            skipClientReview={application.jobPosting?.mrf?.requiresClientReview === false}
          />
        </div>

        {!application.isArchived && canApplicantWithdraw(application.status) && (
          <div className="border-t border-slate-200 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#B91C1C]! hover:bg-[#FEF2F2] hover:text-[#991B1B]!"
              onClick={() => setWithdrawOpen(true)}
            >
              Withdraw application
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scheduled Interviews & Compliance Requirements */}
        <div className="min-w-0 lg:col-span-2 space-y-6">
          {requirementsFirst ? requirementsCard : interviewsCard}
          {requirementsFirst ? interviewsCard : requirementsCard}
        </div>

        {/* Right Column: Position Details */}
        <div className="min-w-0 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 lg:sticky lg:top-24 [overflow-wrap:anywhere]">
            <h2 className="text-sm font-semibold text-[#0B315D] border-b border-slate-200 pb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0B315D]" aria-hidden="true" />
              <span>Position Details</span>
            </h2>

            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <Briefcase className="w-4 h-4 text-[#486581] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-[#486581]">Position Title</dt>
                  <dd className="text-[#102A43] font-semibold text-sm mt-0.5 break-words">{job?.title || "N/A"}</dd>
                </div>
              </div>

              {job?.mrf?.client?.name && (
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#486581] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-[#486581]">Company</dt>
                    <dd className="text-[#102A43] font-medium text-sm mt-0.5 break-words">
                      {job.mrf.client.name}
                      {job.mrf.client.industry ? ` · ${job.mrf.client.industry}` : ""}
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#486581] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-xs font-medium text-[#486581]">Deployment Location</dt>
                  <dd className="text-[#102A43] font-medium text-sm mt-0.5 break-words">{worksite || "Philippines"}</dd>
                </div>
              </div>

              {(employmentTerms.length > 0 || workSchedule || salaryDisplay) && (
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#486581] shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 space-y-1">
                    <dt className="text-xs font-medium text-[#486581]">Employment Details</dt>
                    <dd className="text-[#102A43] text-sm mt-0.5 space-y-0.5 break-words">
                      {employmentTerms.length > 0 && <p className="font-medium">{employmentTerms.join(" · ")}</p>}
                      {workSchedule && <p className="text-xs text-[#486581]">{workSchedule}</p>}
                      {salaryDisplay && <p className="font-semibold text-[#0B315D]">{salaryDisplay}</p>}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            {roleSummary && (
              <div className="pt-3 border-t border-slate-200">
                <span className="text-xs font-medium text-[#486581]">
                  Role Summary
                </span>
                <p className="text-sm text-[#486581] line-clamp-4 mt-1 leading-relaxed break-words">
                  {roleSummary}
                </p>
              </div>
            )}

            {(job?.id || application.jobPostingId) && (
              <div className="pt-3 border-t border-slate-200">
                <Link
                  to="/app/jobs/$jobId"
                  params={{ jobId: String(job?.id ?? application.jobPostingId) }}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#0B315D] hover:bg-slate-50 hover:text-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors md:min-h-9 applicant-touch:min-h-11"
                >
                  <span>View job posting</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <BackoutDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onSubmit={({ reason, notes }) => withdrawMutation.mutate({ reason, notes })}
        loading={withdrawMutation.isPending}
      />

      <RescheduleRequestDialog
        open={rescheduleActivity !== null}
        onClose={() => {
          if (!rescheduleMutation.isPending) setRescheduleActivity(null);
        }}
        activity={rescheduleActivity}
        isSubmitting={rescheduleMutation.isPending}
        onSubmit={(reason, proposedAt) => rescheduleActivity && rescheduleMutation.mutate({ activity: rescheduleActivity, reason, proposedAt })}
      />

      {/* Reuse a document from the applicant's library */}
      <Dialog
        open={Boolean(reuseTarget)}
        onClose={() => {
          if (!reuseMutation.isPending) setReuseTarget(null);
        }}
        title="Use a document from your library"
        size="md"
      >
        <div className="space-y-4">
          {reuseTarget && (
            <p className="text-sm font-semibold text-[#102A43]">For {reuseTarget.documentLabel}</p>
          )}
          <p className="text-sm text-[#486581]">Your recruiter will still review this document for this application.</p>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {(reuseTarget ? libraryMatchesFor(reuseTarget) : []).map((entry) => (
              <li key={entry.documentId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-[#102A43]" title={entry.originalName}>
                    {entry.originalName}
                  </p>
                  <p className="text-xs text-[#486581]">
                    {REQUIREMENT_STATUS_LABEL[entry.reviewStatus] ?? entry.reviewStatus}
                    {" · "}
                    {entry.expiresAt
                      ? `Expires ${formatDate(entry.expiresAt)}${entry.isExpiringSoon ? " (expiring soon)" : ""}`
                      : entry.validityStatus === "NO_EXPIRY"
                      ? "No expiry"
                      : "Expiry not recorded"}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={reuseMutation.isPending}
                  loading={reuseMutation.isPending && reuseMutation.variables?.documentId === entry.documentId}
                  onClick={() => {
                    if (reuseTarget) {
                      reuseMutation.mutate({ requirementId: reuseTarget.id, documentId: entry.documentId });
                    }
                  }}
                >
                  Use this document
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" disabled={reuseMutation.isPending} onClick={() => setReuseTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        open={Boolean(previewDocState?.open)}
        onClose={() => setPreviewDocState(null)}
        documentId={previewDocState?.documentId}
        title={previewDocState?.title || "Document Preview"}
        requirementStatus={previewDocState?.requirementStatus}
      />
    </div>
  );
};
