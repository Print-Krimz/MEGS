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
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  MapPin,
  FileCheck2,
  Clock,
  Upload,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export const ApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams({ strict: false }) as { applicationId: string };
  const queryClient = useQueryClient();
  const [activeUploadReqId, setActiveUploadReqId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const applicationQuery = useQuery({
    queryKey: ["applicant", "application", applicationId],
    queryFn: () => applicantJobsApi.getApplicationDetail(applicationId),
    enabled: Boolean(applicationId),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ requirementId, file }: { requirementId: number; file: File }) =>
      applicantJobsApi.uploadComplianceDocument(requirementId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "application", applicationId] });
      setFeedback({
        type: "success",
        message: "Document uploaded successfully and submitted for recruiter verification.",
      });
      setActiveUploadReqId(null);
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: "Failed to upload document: " + (err?.message || "An error occurred"),
      });
      setActiveUploadReqId(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadReqId) {
      uploadMutation.mutate({ requirementId: activeUploadReqId, file });
    }
    // reset input
    if (e.target) e.target.value = "";
  };

  if (applicationQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application Details" description="Loading tracking records..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (applicationQuery.isError || !applicationQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application Details"
          description="Tracking records"
        />
        {applicationQuery.isError ? (
          <ErrorState
            error={applicationQuery.error}
            onRetry={() => applicationQuery.refetch()}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-4 shadow-xs">
            <p className="text-xs text-slate-600">
              This application does not exist or you do not have permission to view it.
            </p>
            <Link to="/app/applications">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Applications
              </Button>
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
        description={`Application Reference: #${application.id}`}
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Applications", href: "/app/applications" },
          { label: job?.title || "Application Details" },
        ]}
        actions={
          <Link to="/app/applications">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back to Tracker
            </Button>
          </Link>
        }
      />

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
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
      <div className="bg-white border border-slate-300 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold uppercase text-slate-600">
                Current Hiring Stage:
              </span>
              <StatusBadge status={application.status} size="sm" />
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Submitted on {formatDate(application.createdAt)}
            </div>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <div className="py-1">
          <PipelineIndicator currentStatus={application.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Scheduled Interviews & Compliance Requirements */}
        <div className="md:col-span-2 space-y-5">
          {/* Scheduled Interviews Card */}
          <div className="bg-white border border-slate-300">
            <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
              <Calendar className="w-4 h-4 text-blue-700" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                Scheduled Interviews & Assessments
              </h3>
            </div>

            {interviews.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400">
                No interviews scheduled yet. Once our recruitment team reviews your application, interview details will appear here.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 p-4 space-y-3">
                {interviews.map((interview) => (
                  <div key={interview.id} className="pt-2 space-y-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-950 uppercase">
                        {interview.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-900 border border-blue-300 uppercase">
                        {interview.result || "SCHEDULED"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDateTime(interview.scheduledAt || interview.createdAt)}</span>
                    </div>

                    {interview.notes && (
                      <p className="text-xs text-slate-600 font-sans italic mt-1">
                        Notes: {interview.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Compliance Requirements Checklist */}
          <div className="bg-white border border-slate-300">
            <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900">
                  Pre-Employment 201 Compliance Checklist
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {compliance.filter((c) => c.reviewStatus === "APPROVED").length} / {compliance.length} Approved
              </span>
            </div>

            {compliance.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-slate-400">
                No active document requirements pending at this stage. Requirements will be assigned once hired.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {compliance.map((req) => {
                  const isApproved = req.reviewStatus === "APPROVED";
                  const isRejected = req.reviewStatus === "REJECTED";
                  const isSubmitted = req.reviewStatus === "SUBMITTED";

                  return (
                    <div key={req.id} className="p-4 space-y-2 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-950 font-mono uppercase">
                              {req.documentLabel}
                            </span>
                            {req.isRequired && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                                Mandatory
                              </span>
                            )}
                          </div>
                          {req.deadline && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Deadline: {formatDate(req.deadline)}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 border ${
                              isApproved
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : isRejected
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : isSubmitted
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-slate-100 text-slate-800 border-slate-300"
                            }`}
                          >
                            {req.reviewStatus}
                          </span>

                          {req.documentId && (
                            <a
                              href={`/api/documents/${req.documentId}/download`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:text-blue-800 underline ml-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
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
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            Document Rejected by Recruiter
                          </div>
                          <p className="text-rose-700 pl-5 text-[11px]">
                            {req.reviewNotes || "Please review document requirements and re-upload a clear and valid copy."}
                          </p>
                        </div>
                      )}

                      {isApproved && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-mono">
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
          <div className="bg-white border border-slate-300 p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
              Position Details
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold uppercase font-mono text-[10px] text-slate-500">Position Title</div>
                  <div className="text-slate-900 font-bold">{job?.title || "N/A"}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold uppercase font-mono text-[10px] text-slate-500">Deployment Location</div>
                  <div className="text-slate-800">{job?.location || "Philippines"}</div>
                </div>
              </div>
            </div>

            {job?.description && (
              <div className="pt-3 border-t border-slate-200">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  Role Description:
                </span>
                <p className="text-xs text-slate-600 line-clamp-4 mt-1 leading-normal font-sans">
                  {job.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
