import React, { useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { formatDate } from "../../lib/utils";
import {
  MapPin,
  Clock,
  Send,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  ArrowLeft,
} from "lucide-react";

export const JobDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { jobId } = useParams({ strict: false }) as { jobId: string };

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [customResume, setCustomResume] = useState<File | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const jobQuery = useQuery({
    queryKey: ["applicant", "job-detail", jobId],
    queryFn: () => applicantJobsApi.getJobDetail(jobId),
    enabled: Boolean(jobId),
  });

  const applyMutation = useMutation({
    mutationFn: (body?: FormData | { resumeUrl?: string }) =>
      applicantJobsApi.applyToJob(jobId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setSubmissionSuccess(true);
    },
  });

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (customResume) {
      const formData = new FormData();
      formData.append("file", customResume);
      applyMutation.mutate(formData);
    } else {
      applyMutation.mutate({});
    }
  };

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Requisition Details" description="Loading position..." />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Requisition Details" description="Position details" />
        <ErrorState error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  const job = jobQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={`Requisition #${job.id} • ${job.location || "Philippines"}`}
        breadcrumbs={[
          { label: "Applicant Portal", href: "/app" },
          { label: "Job Board", href: "/app/jobs" },
          { label: job.title },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/jobs">
              <Button
                variant="outline"
                size="md"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Jobs
              </Button>
            </Link>
            {job.alreadyApplied ? (
              <Button
                variant="outline"
                size="md"
                disabled
                leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              >
                Application Submitted
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Send className="w-4 h-4" />}
                onClick={() => setApplyModalOpen(true)}
              >
                Apply for Position
              </Button>
            )}
          </div>
        }
      />

      {/* Position Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          {/* Main Description */}
          <div className="bg-white border border-slate-300 p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
              Position Overview
            </h3>
            <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
              {job.description}
            </div>
          </div>

          {/* Requirements & Criteria */}
          {job.requirements && (
            <div className="bg-white border border-slate-300 p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-2">
                Job Requirements & Qualifications
              </h3>
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans">
                {job.requirements}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Metadata Card */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-300 p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2">
              Requisition Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900 uppercase font-mono text-[10px]">Position Status</div>
                  <div className="text-slate-700 font-mono font-bold text-xs">{job.status}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900 uppercase font-mono text-[10px]">Deployment Location</div>
                  <div className="text-slate-700">{job.location || "Nationwide"}</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-900 uppercase font-mono text-[10px]">Requisition Posted</div>
                  <div className="text-slate-700 font-mono">{formatDate(job.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              {job.alreadyApplied ? (
                <div className="p-3 bg-teal-50 border border-teal-300 text-xs text-teal-950 text-center font-medium space-y-2">
                  <div className="font-mono uppercase font-bold text-[10px]">Application on file</div>
                  <Link to="/app/applications">
                    <Button variant="outline" size="sm" className="w-full mt-1">
                      View Tracker
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Send className="w-4 h-4" />}
                  className="w-full"
                  onClick={() => setApplyModalOpen(true)}
                >
                  Submit Candidacy
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      <Dialog
        open={applyModalOpen}
        onClose={() => {
          setApplyModalOpen(false);
          setSubmissionSuccess(false);
        }}
        title={`Apply for ${job.title}`}
        description="Confirm your profile details and submit your application."
      >
        {submissionSuccess ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">Application Submitted</h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
                Your application has been received and is now being reviewed by our recruitment team.
              </p>
            </div>
            <div className="pt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setApplyModalOpen(false);
                  setSubmissionSuccess(false);
                }}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => navigate({ to: "/app/applications" })}
              >
                View Tracker
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900">Applicant Profile Information:</div>
              <p>
                Your saved education, work experience, and character references will automatically be attached to this job application.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Custom Resume for this Role (Optional)
              </label>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCustomResume(file);
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{customResume ? "Replace PDF" : "Attach Tailored Resume (PDF)"}</span>
                  </span>
                </label>
                {customResume && (
                  <span className="text-xs font-mono text-teal-800 flex items-center gap-1 truncate max-w-[200px]">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {customResume.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                If omitted, your active profile resume on file will be used.
              </p>
            </div>

            {applyMutation.isError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {applyMutation.error?.message || "Failed to submit application. Please try again."}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApplyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={applyMutation.isPending}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Confirm & Submit
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
};
