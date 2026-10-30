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
import { formatDate, formatDateTime } from "../../lib/utils";
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
} from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";
import type { ComplianceRequirement, RescheduleActivity } from "../../lib/types/application.types";
import { RescheduleControl, RescheduleRequestDialog } from "../../components/applicant/RescheduleRequest";
import { RequirementStatusBadge } from "../../components/applicant/RequirementStatusBadge";
import { notify } from "../../lib/feedback";
import { getApplicationRefetchInterval } from "../../lib/query-policies";
import { addManilaCalendarDays, getManilaToday, toManilaDateInput } from "../../lib/field-limits";

const normalizeDocumentLabel = (value: string) => value.trim().toLowerCase();

type RequirementRef = Pick<ComplianceRequirement, "id" | "documentId" | "documentLabel" | "reviewStatus">;

const libraryStatusLabel: Record<string, string> = {
  APPROVED: "Verified",
  SUBMITTED: "Pending review",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  PENDING: "Not submitted",
  TO_FOLLOW: "To follow",
};

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
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewDocState, setPreviewDocState] = useState<{
    open: boolean;
    documentId?: number | null;
    title?: string;
    requirementStatus?: string;
  } | null>(null);
  const [reuseTarget, setReuseTarget] = useState<RequirementRef | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [rescheduleActivity, setRescheduleActivity] = useState<RescheduleActivity | null>(null);

  const applicationQuery = useQuery({
    queryKey: ["applicant", "application", applicationId],
    queryFn: ({ signal }) => applicantJobsApi.getApplicationDetail(applicationId, { signal }),
    enabled: Boolean(applicationId),
    refetchInterval: (query) => getApplicationRefetchInterval(query.state.data),
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
    mutationFn: ({ requirementId, file }: { requirementId: number; file: File }) =>
      applicantJobsApi.uploadComplianceDocument(requirementId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      const successMsg = "Document uploaded successfully and submitted for recruiter verification.";
      setFeedback({
        type: "success",
        message: successMsg,
      });
      notify.success("Document Uploaded", successMsg);
      setActiveUploadReqId(null);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to upload document: " + (err?.message || "An error occurred"),
      });
      notify.error("Upload Failed", err);
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
    mutationFn: (data: { activity: RescheduleActivity; reason: string }) => applicantJobsApi.requestReschedule(applicationId, data),
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
      const successMsg = "Document added to this requirement and submitted for recruiter verification.";
      setFeedback({ type: "success", message: successMsg });
      notify.success("Document Reused", successMsg);
      setReuseTarget(null);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to use document: " + (err?.message || "An error occurred"),
      });
      notify.error("Unable to Use Document", err);
      setReuseTarget(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadReqId) {
      if (!COMPLIANCE_UPLOAD_TYPES.includes(file.type)) {
        notify.error("Unsupported File Type", "Upload a PDF, DOC, DOCX, JPG, PNG, or WEBP file.");
        if (e.target) e.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.error("File Too Large", "Maximum upload size is 5 MB. Please select a smaller file.");
        if (e.target) e.target.value = "";
        return;
      }
      uploadMutation.mutate({ requirementId: activeUploadReqId, file });
    }
    // reset input
    if (e.target) e.target.value = "";
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
        onClick={() => setReuseTarget(req)}
      >
        Use a document from my library
      </Button>
    );
  };

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application details" description="Loading your application…" />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application details"
          description="Application progress"
        />
        {applicationQuery.isError ? (
          <ErrorState
            error={applicationQuery.error}
            onRetry={() => applicationQuery.refetch()}
          />
        ) : (
          <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 text-center space-y-4 shadow-xs">
            <p className="text-xs text-[#627D98]">
              This application does not exist or you do not have permission to view it.
            </p>
            <Link to="/app/applications" className="inline-flex min-h-[44px] items-center rounded-md border border-[#D9E2EC] bg-white px-4 text-sm font-medium text-[#102A43] hover:bg-[#F7F9FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors">
              Back to applications
            </Link>
          </div>
        )}
      </div>
    );
  }

  const application = applicationQuery.data;
  const job = application.jobPosting;
  const interviews = application.interviews || [];
  const compliance = application.complianceRequirements || [];
  const isDeployed = application.status === ApplicationStatus.DEPLOYED;
  const pendingFollowUps = compliance.filter((c) => c.reviewStatus !== "APPROVED");
  const approvedClearances = compliance.filter((c) => c.reviewStatus === "APPROVED");

  return (
    <div className="space-y-6">
      {/* Hidden file input for document uploading */}
      <input
        ref={fileInputRef}
        type="file"
        accept={COMPLIANCE_UPLOAD_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />

      <PageHeader
        title={job?.title || "Application Details"}
        description="Follow your application progress and upcoming steps."
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "Applications", href: "/app/applications" },
          { label: job?.title || "Application Details" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {application && !application.isArchived && canApplicantWithdraw(application.status) && (
              <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
                Withdraw application
              </Button>
            )}
          <Link to="/app/applications" className="inline-flex min-h-10 items-center rounded-md border border-[#D9E2EC] bg-white px-4 text-sm font-medium text-[#0B315D] hover:bg-[#EAF0F7] hover:text-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors">
            Back to applications
          </Link>
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#047857]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] font-bold underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Progress Card */}
      <div className="bg-white border border-[#D9E2EC] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E2EC] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium text-[#627D98]">
                Current status
              </span>
              <StatusBadge status={application.status} audience="applicant" size="sm" />
            </div>
            <div className="text-sm text-[#627D98]">
              Submitted on {formatDate(application.createdAt)}
            </div>
          </div>
        </div>

        {/* Supporting message for Future Opportunities */}
        {application.status === ApplicationStatus.TALENT_POOL && (
          <div className="p-4 bg-[#F7F9FC] border-l-4 border-[#0B315D] border border-[#D9E2EC] rounded-lg space-y-1">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-[#0B315D] shrink-0" />
              <h4 className="text-sm font-semibold text-[#102A43]">
                Future opportunities
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#627D98] leading-relaxed">
              You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.
            </p>
          </div>
        )}

        {(application.status === ApplicationStatus.CONTRACT_SIGNING || application.status === ApplicationStatus.ONBOARDING) && (
          <div className="p-4 bg-[#F8FAFC] border-l-4 border-[#6D4FD3] border border-[#D9E2EC] rounded-lg space-y-1">
            <h4 className="text-sm font-semibold text-[#102A43]">Pre-employment documents approved</h4>
            {application.contractSigningAt ? (
              <>
                <p className="text-xs sm:text-sm text-[#102A43] leading-relaxed">
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
              <p className="text-xs sm:text-sm text-[#627D98] leading-relaxed">
                Your TA will contact you to sign your employment contract. Check your email for updates.
              </p>
            )}
          </div>
        )}

        {isDeployed && (
          pendingFollowUps.length > 0 ? (
            <div className="p-4 bg-[#FFFBEB] border-l-4 border-[#D97706] border border-[#FDE68A] rounded-lg space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
                  <h4 className="text-sm font-semibold text-[#92400E]">
                    Deployed to work site - Follow-up requirements pending
                  </h4>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] self-start sm:self-auto font-mono">
                  {pendingFollowUps.length} requirement(s) pending follow-up
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#78350F] leading-relaxed">
                You are actively deployed. Upload your remaining requirements once available.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-[#ECFDF5] border-l-4 border-[#047857] border border-[#A7F3D0] rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                <h4 className="text-sm font-semibold text-[#047857]">
                  Deployed to work site - 100% Compliant
                </h4>
              </div>
              <p className="text-xs sm:text-sm text-[#102A43] leading-relaxed">
                All pre-employment and post-deployment requirements are verified. Your 201 file is complete.
              </p>
            </div>
          )
        )}

        {/* Pipeline Stepper */}
        <div className="py-1">
          <PipelineIndicator
            currentStatus={application.status}
            audience="applicant"
            hideTerminalAlert
            skipClientReview={application.jobPosting?.mrf?.requiresClientReview === false}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Scheduled Interviews & Compliance Requirements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scheduled Interviews Card */}
          <div className="bg-white border border-[#D9E2EC] rounded-lg overflow-hidden">
            <div className="p-3.5 border-b border-[#D9E2EC] flex items-center gap-2 bg-[#F7F9FC]">
              <Calendar className="w-4 h-4 text-[#0B315D]" />
              <h3 className="text-sm font-semibold text-[#102A43]">
                Interviews and assessments
              </h3>
            </div>

            {interviews.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#627D98]">
                No interviews scheduled yet. Once our recruitment team reviews your application, interview details will appear here.
              </div>
            ) : (
              <div className="divide-y divide-[#D9E2EC] p-4 space-y-3">
                {interviews.map((interview) => {
                  const isPassed = interview.result === "PASS" || interview.result === "PASSED";
                  const isFailed = interview.result === "FAIL" || interview.result === "FAILED";
                  const isNoShow = interview.result === "NO_SHOW";

                  return (
                    <div key={interview.id} className="py-3 space-y-1.5 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#102A43] uppercase">
                          {interview.type.replace(/_/g, " ")}
                        </span>
                        {isPassed ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-emerald-700" /> PASS
                          </span>
                        ) : isFailed ? (
                          <span className="bg-rose-100 text-rose-900 border border-rose-300 font-bold px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5">
                            <X className="w-3 h-3 text-rose-700" /> NOT PASSED
                          </span>
                        ) : isNoShow ? (
                          <span className="bg-slate-100 text-slate-900 border border-slate-300 font-bold px-2.5 py-1 text-xs rounded-full">
                            NO SHOW
                          </span>
                        ) : (
                          <span className="bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2.5 py-1 text-xs rounded-full inline-flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-blue-700" /> SCHEDULED
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-[#627D98] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#627D98]" />
                        <span>{formatDateTime(interview.scheduledAt || interview.createdAt)}</span>
                      </div>

                      {interview.location && (
                        <div className="text-[11px] text-[#627D98] flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-[#627D98] shrink-0" />
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
                        <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200/90 rounded-md space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span>Evaluation &amp; Interview Notes</span>
                          </div>
                          <p className="text-xs text-slate-900 font-sans font-medium leading-relaxed pl-2.5 border-l-2 border-slate-400">
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

          {/* Compliance Requirements Checklist */}
          {isDeployed ? (
            <div className="space-y-6">
              {compliance.length === 0 && (
                <div className="bg-white border border-[#D9E2EC] rounded-lg shadow-xs overflow-hidden">
                  <div className="p-3.5 border-b border-[#D9E2EC] flex items-center justify-between bg-[#F7F9FC]">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-[#0B315D]" />
                      <h3 className="text-sm font-semibold text-[#102A43]">
                        Requirements
                      </h3>
                    </div>
                  </div>
                  <div className="p-6 text-center text-xs font-mono text-[#627D98]">
                    No active document requirements are assigned yet.
                  </div>
                </div>
              )}

              {/* Requirements to follow up (Action needed) */}
              {pendingFollowUps.length > 0 && (
                <div className="bg-white border border-[#D9E2EC] rounded-lg shadow-xs overflow-hidden">
                  <div className="p-3.5 border-b border-[#D9E2EC] flex items-center justify-between bg-[#FFFBEB]">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#D97706]" />
                      <h3 className="text-sm font-semibold text-[#92400E]">
                        Requirements to follow up (Action needed)
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-medium text-[#B45309]">
                      {pendingFollowUps.length} pending
                    </span>
                  </div>

                  <div className="divide-y divide-[#D9E2EC]">
                    {pendingFollowUps.map((req) => {
                      const isRejected = req.reviewStatus === "REJECTED";
                      const targetDate = req.updateRequestDeadline || req.toFollowExpectedAt || req.deadline;

                      return (
                        <div key={req.id} className="p-4 space-y-2 hover:bg-[#F7F9FC] transition-colors">
                          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#102A43] font-mono uppercase">
                                  {req.documentLabel}
                                </span>
                              </div>
                              {targetDate && (
                                <div className="text-[10px] text-[#627D98] font-mono">
                                  Target date: {formatDate(targetDate)}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                              <RequirementStatusBadge status={req.reviewStatus} />

                              {req.documentId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDocState({
                                      open: true,
                                      documentId: req.documentId,
                                      title: req.documentLabel,
                                      requirementStatus: req.reviewStatus,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0B315D] hover:underline ml-1 cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  View
                                </button>
                              )}

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
                                {req.documentId ? "Replace File" : "Upload File"}
                              </Button>

                              {renderLibraryAction(req)}
                            </div>
                          </div>

                          {isRejected && req.reviewNotes && (
                            <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] space-y-0.5">
                              <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                                <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                                Document Rejected by Recruiter
                              </div>
                              <p className="text-[#DC2626] pl-5 text-[11px]">
                                {req.reviewNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Verified 201 clearances */}
              {approvedClearances.length > 0 && (
                <div className="bg-white border border-[#D9E2EC] rounded-lg shadow-xs overflow-hidden">
                  <div className="p-3.5 border-b border-[#D9E2EC] flex items-center justify-between bg-[#F7F9FC]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#047857]" />
                      <h3 className="text-sm font-semibold text-[#102A43]">
                        Verified 201 clearances
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-medium text-[#047857]">
                      {approvedClearances.length} verified
                    </span>
                  </div>

                  <div className="divide-y divide-[#D9E2EC]">
                    {approvedClearances.map((req) => (
                      <div key={req.id} className="p-4 space-y-2 hover:bg-[#F7F9FC] transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#102A43] font-mono uppercase">
                                {req.documentLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <RequirementStatusBadge status="APPROVED" />

                            <button
                              type="button"
                              disabled={!req.documentId}
                              onClick={() => {
                                if (req.documentId) {
                                  setPreviewDocState({
                                    open: true,
                                    documentId: req.documentId,
                                    title: req.documentLabel,
                                    requirementStatus: req.reviewStatus,
                                  });
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0B315D] hover:underline ml-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </button>
                            {req.expiresAt && toManilaDateInput(req.expiresAt) <= addManilaCalendarDays(getManilaToday(), 30) && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={uploadMutation.isPending}
                                loading={uploadMutation.isPending && activeUploadReqId === req.id}
                                leftIcon={<Upload className="w-3.5 h-3.5" />}
                                onClick={() => {
                                  setActiveUploadReqId(req.id);
                                  fileInputRef.current?.click();
                                }}
                              >
                                Upload updated copy
                              </Button>
                            )}
                          </div>
                        </div>

                        {req.expiresAt && (
                          <div className={`text-[11px] font-mono ${toManilaDateInput(req.expiresAt) < getManilaToday() ? "text-rose-700" : "text-amber-700"}`}>
                            {toManilaDateInput(req.expiresAt) < getManilaToday() ? "Expired" : "Expiring soon"} · Expires {formatDate(req.expiresAt)}
                          </div>
                        )}

                        <div className="flex items-center gap-1 text-[10px] text-[#047857] font-mono">
                          <CheckCircle2 className="w-3 h-3" /> Verified by recruitment team
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#D9E2EC] rounded-lg shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-[#D9E2EC] flex items-center justify-between bg-[#F7F9FC]">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-[#0B315D]" />
                  <h3 className="text-sm font-semibold text-[#102A43]">
                    Requirements
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#627D98]">
                  {compliance.filter((c) => c.reviewStatus === "APPROVED").length} / {compliance.length} Approved
                </span>
              </div>

              {compliance.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-[#627D98]">
                  {(application.status === ApplicationStatus.CONTRACT_SIGNING || application.status === ApplicationStatus.ONBOARDING)
                    ? "No additional requirements are pending. Contract signing is the next step."
                    : "No active document requirements are assigned yet. We’ll show them here when they are ready."}
                </div>
              ) : (
                <div className="divide-y divide-[#D9E2EC]">
                  {compliance.map((req) => {
                    const isApproved = req.reviewStatus === "APPROVED";
                    const isRejected = req.reviewStatus === "REJECTED";

                    return (
                      <div key={req.id} className="p-4 space-y-2 hover:bg-[#F7F9FC] transition-colors">
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#102A43] font-mono uppercase">
                                {req.documentLabel}
                              </span>
                            </div>
                            {req.deadline && (
                              <div className="text-[10px] text-[#627D98] font-mono">
                                Deadline: {formatDate(req.deadline)}
                              </div>
                            )}
                            {req.reviewStatus === "TO_FOLLOW" && req.toFollowExpectedAt && (
                              <div className="text-[10px] text-[#627D98] font-mono">
                                Expected by {formatDate(req.toFollowExpectedAt)}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                            <RequirementStatusBadge status={req.reviewStatus} />

                            {req.documentId && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewDocState({
                                    open: true,
                                    documentId: req.documentId,
                                    title: req.documentLabel,
                                    requirementStatus: req.reviewStatus,
                                  })
                                }
                                className="inline-flex items-center gap-1 text-[11px] font-mono text-[#0B315D] hover:underline ml-1 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </button>
                            )}

                            {!isApproved && (
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
                                {req.documentId ? "Replace File" : "Upload File"}
                              </Button>
                            )}

                            {renderLibraryAction(req)}
                          </div>
                        </div>

                        {/* Rejection / Review Feedback */}
                        {isRejected && (
                          <div className="p-2.5 bg-[#FEF2F2] border border-[#FECACA] rounded text-xs text-[#DC2626] space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                              <AlertCircle className="w-3.5 h-3.5 text-[#DC2626]" />
                              Document Rejected by Recruiter
                            </div>
                            <p className="text-[#DC2626] pl-5 text-[11px]">
                              {req.reviewNotes || "Please review document requirements and re-upload a clear and valid copy."}
                            </p>
                          </div>
                        )}

                        {isApproved && (
                          <div className="flex items-center gap-1 text-[10px] text-[#047857] font-mono">
                            <CheckCircle2 className="w-3 h-3" /> Verified by recruitment team
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Requisition Information */}
        <div className="space-y-4">
          <div className="bg-white border border-[#D9E2EC] rounded-lg p-5 space-y-4 shadow-xs sticky top-6">
            <h3 className="text-sm font-semibold text-[#102A43] border-b border-[#D9E2EC] pb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0B315D]" />
              <span>Position Details</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Briefcase className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-[#627D98]">Position Title</div>
                  <div className="text-[#102A43] font-semibold text-xs mt-0.5">{job?.title || "N/A"}</div>
                </div>
              </div>

              {job?.mrf?.client?.name && (
                <div className="flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[11px] font-medium text-[#627D98]">Company</div>
                    <div className="text-[#102A43] font-medium text-xs mt-0.5">{job.mrf.client.name}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-[#627D98]">Deployment Location</div>
                  <div className="text-[#102A43] font-medium text-xs mt-0.5">{job?.location || "Philippines"}</div>
                </div>
              </div>
            </div>

            {job?.description && (
              <div className="pt-3 border-t border-[#D9E2EC]">
                <span className="text-[11px] font-medium text-[#627D98]">
                  Role Description:
                </span>
                <p className="text-xs text-[#627D98] line-clamp-4 mt-1 leading-relaxed">
                  {job.description}
                </p>
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
        onSubmit={(reason) => rescheduleActivity && rescheduleMutation.mutate({ activity: rescheduleActivity, reason })}
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
          <p className="text-sm text-[#627D98]">Your recruiter will still review this document for this application.</p>
          <ul className="divide-y divide-[#D9E2EC] rounded-md border border-[#D9E2EC]">
            {(reuseTarget ? libraryMatchesFor(reuseTarget) : []).map((entry) => (
              <li key={entry.documentId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-[#102A43]" title={entry.originalName}>
                    {entry.originalName}
                  </p>
                  <p className="text-xs text-[#627D98]">
                    {libraryStatusLabel[entry.reviewStatus] ?? entry.reviewStatus}
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
