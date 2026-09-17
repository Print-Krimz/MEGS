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
import { Button } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import {
  Briefcase,
  Calendar,
  MapPin,
  FileCheck2,
  Clock,
  Upload,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Bookmark,
} from "lucide-react";
import { ApplicationStatus } from "../../lib/types/enums";
import { notify } from "../../lib/feedback";

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

  const applicationQuery = useQuery({
    queryKey: ["applicant", "application", applicationId],
    queryFn: () => applicantJobsApi.getApplicationDetail(applicationId),
    enabled: Boolean(applicationId),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadReqId) {
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

  return (
    <div className="space-y-6">
      {/* Hidden file input for document uploading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/jpg"
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
          <Link to="/app/applications" className="inline-flex min-h-10 items-center rounded-md border border-[#D9E2EC] bg-white px-4 text-sm font-medium text-[#0B315D] hover:bg-[#EAF0F7] hover:text-[#082747] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors">
            Back to applications
          </Link>
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

        {(application.status === ApplicationStatus.CONTRACT_AND_ORIENTATION || application.status === ApplicationStatus.ONBOARDING) && (
          <div className="p-4 bg-[#F8FAFC] border-l-4 border-[#6D4FD3] border border-[#D9E2EC] rounded-lg space-y-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#102A43]">
                {application.contractSigned && application.orientationCompleted
                  ? "Contract signed and orientation completed"
                  : "Pre-employment documents approved"}
              </h4>
              <p className="text-xs sm:text-sm text-[#627D98] leading-relaxed">
                {application.contractSigned && application.orientationCompleted
                  ? "Talent Acquisition is finalizing your deployment date and site reporting details."
                  : "We are preparing your employment contract and orientation schedule. Check your email for updates."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded border font-medium ${
                  application.contractSigned
                    ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                    : "bg-[#F7F9FC] text-[#627D98] border-[#D9E2EC]"
                }`}
              >
                {application.contractSigned ? "Contract: Signed" : "Contract: Pending"}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded border font-medium ${
                  application.orientationCompleted
                    ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                    : "bg-[#F7F9FC] text-[#627D98] border-[#D9E2EC]"
                }`}
              >
                {application.orientationCompleted ? "Orientation: Completed" : "Orientation: Pending"}
              </span>
            </div>
          </div>
        )}

        {application.status === ApplicationStatus.DEPLOYED && (
          <div className="p-4 bg-[#ECFDF5] border-l-4 border-[#047857] border border-[#A7F3D0] rounded-lg space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
              <h4 className="text-sm font-semibold text-[#047857]">
                Deployed to work site
              </h4>
            </div>
            <p className="text-xs sm:text-sm text-[#102A43] leading-relaxed">
              You are actively deployed. Your employment record and site placement are active.
            </p>
          </div>
        )}

        {/* Pipeline Stepper */}
        <div className="py-1">
          <PipelineIndicator currentStatus={application.status} audience="applicant" hideTerminalAlert />
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
                {interviews.map((interview) => (
                  <div key={interview.id} className="pt-2 space-y-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#102A43] uppercase">
                        {interview.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#F3F0FF] text-[#6D4FD3] border border-[#DDD6FE] uppercase rounded">
                        {interview.result || "SCHEDULED"}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#627D98] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#627D98]" />
                      <span>{formatDateTime(interview.scheduledAt || interview.createdAt)}</span>
                    </div>

                    {interview.notes && (
                      <p className="text-xs text-[#627D98] font-sans italic mt-1">
                        Notes: {interview.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compliance Requirements Checklist */}
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
                {(application.status === ApplicationStatus.CONTRACT_AND_ORIENTATION || application.status === ApplicationStatus.ONBOARDING)
                  ? "No additional requirements are pending. Contract and orientation are the next steps."
                  : "No active document requirements are assigned yet. We’ll show them here when they are ready."}
              </div>
            ) : (
              <div className="divide-y divide-[#D9E2EC]">
                {compliance.map((req) => {
                  const isApproved = req.reviewStatus === "APPROVED";
                  const isRejected = req.reviewStatus === "REJECTED";
                  const isSubmitted = req.reviewStatus === "SUBMITTED";

                  return (
                    <div key={req.id} className="p-4 space-y-2 hover:bg-[#F7F9FC] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#102A43] font-mono uppercase">
                              {req.documentLabel}
                            </span>
                            {req.isRequired && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-[#FFF7ED] text-[#B45309] border border-[#FED7AA] uppercase rounded">
                                Mandatory
                              </span>
                            )}
                          </div>
                          {req.deadline && (
                            <div className="text-[10px] text-[#627D98] font-mono">
                              Deadline: {formatDate(req.deadline)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 border rounded ${
                              isApproved
                                ? "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]"
                                : isRejected
                                ? "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]"
                                : isSubmitted
                                ? "bg-[#FFF7ED] text-[#B45309] border-[#FED7AA]"
                                : "bg-[#F7F9FC] text-[#627D98] border-[#D9E2EC]"
                            }`}
                          >
                            {req.reviewStatus}
                          </span>

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
                            disabled={isApproved || uploadMutation.isPending}
                            loading={uploadMutation.isPending && activeUploadReqId === req.id}
                            leftIcon={<Upload className="w-3.5 h-3.5" />}
                            onClick={() => {
                              setActiveUploadReqId(req.id);
                              fileInputRef.current?.click();
                            }}
                          >
                            {isApproved ? "Approved" : req.documentId ? "Replace File" : "Upload File"}
                          </Button>
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
