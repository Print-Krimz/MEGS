import React, { useState } from "react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applicantJobsApi } from "../../lib/api/applicant-jobs.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  JobImage,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import {
  formatDate,
  formatSalaryRange,
  formatEmploymentType,
  formatWorkArrangement,
} from "../../lib/utils";
import {
  MapPin,
  Clock,
  Send,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Briefcase,
  Bookmark,
  Banknote,
  Building2,
} from "lucide-react";
import { notify, formatErrorMessage } from "../../lib/feedback";

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

  const savedJobIdsQuery = useQuery({
    queryKey: ["applicant", "saved-jobs", "ids"],
    queryFn: applicantJobsApi.getSavedJobIds,
  });

  const isSaved = (savedJobIdsQuery.data || []).includes(Number(jobId));

  const saveMutation = useMutation({
    mutationFn: () => applicantJobsApi.saveJob(Number(jobId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Saved", "Position added to your saved jobs.");
    },
    onError: (err: any) => notify.error("Save Failed", err),
  });

  const unsaveMutation = useMutation({
    mutationFn: () => applicantJobsApi.unsaveJob(Number(jobId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant", "saved-jobs"] });
      notify.success("Job Removed", "Position removed from your saved jobs.");
    },
    onError: (err: any) => notify.error("Action Failed", err),
  });

  const handleToggleSave = () => {
    if (isSaved) {
      unsaveMutation.mutate();
    } else {
      saveMutation.mutate();
    }
  };

  const applyMutation = useMutation({
    mutationFn: (body?: FormData | { resumeUrl?: string }) =>
      applicantJobsApi.applyToJob(jobId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applicant"] });
      setSubmissionSuccess(true);
      notify.success("Application Submitted", "Your candidacy has been received and is now being reviewed.");
    },
    onError: (err) => {
      notify.error("Application Failed", err);
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
        <PageHeader title="Job details" description="Loading position…" />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job details" description="Position details" />
        <ErrorState error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  const job = jobQuery.data;
  const salaryDisplay = formatSalaryRange(job.mrf?.salaryRangeMin, job.mrf?.salaryRangeMax);
  const employmentTypeDisplay = formatEmploymentType(job.mrf?.employmentType);
  const workArrangementDisplay = formatWorkArrangement(job.mrf?.workArrangement);

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={job.department ? `${job.department} · ${job.location || "Philippines"}` : (job.location || "Philippines")}
        breadcrumbs={[
          { label: "My career", href: "/app" },
          { label: "Explore jobs", href: "/app/jobs" },
          { label: job.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/jobs"
              className="inline-flex min-h-[44px] items-center rounded-md border border-[#D9E2EC] bg-white px-4 text-sm font-medium text-[#102A43] hover:bg-[#EAF0F7] hover:text-[#0B315D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-2 transition-colors"
            >
              Back to jobs
            </Link>

            <Button
              variant="outline"
              size="md"
              leftIcon={<Bookmark className={`w-4 h-4 ${isSaved ? "fill-[#0B315D] text-[#0B315D]" : ""}`} />}
              onClick={handleToggleSave}
            >
              {isSaved ? "Saved for Later" : "Save for Later"}
            </Button>

            {job.alreadyApplied ? (
              <div className="lg:hidden">
                <Link to="/app/applications">
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={<CheckCircle2 className="w-4 h-4 text-[#047857]" />}
                  >
                    Application submitted (View in Tracker)
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="lg:hidden">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => setApplyModalOpen(true)}
                >
                  Apply for this job
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Position Details Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Description */}
          <div className="bg-white border border-[#D9E2EC] rounded-lg p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-[#102A43] border-b border-[#D9E2EC] pb-3 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#0B315D]" />
              <span>Position Overview</span>
            </h3>
            <div className="text-sm text-[#102A43] leading-relaxed whitespace-pre-line">
              {job.description}
            </div>
          </div>

          {/* Requirements & Criteria */}
          {job.requirements && (
            <div className="bg-white border border-[#D9E2EC] rounded-lg p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-[#102A43] border-b border-[#D9E2EC] pb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0B315D]" />
                <span>What you need for this role</span>
              </h3>
              <div className="text-sm text-[#102A43] leading-relaxed whitespace-pre-line">
                {job.requirements}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Metadata Card */}
        <div className="space-y-4">
          <div className="bg-white border border-[#D9E2EC] rounded-lg p-5 shadow-xs space-y-5 sticky top-6">
            <div className="flex items-center gap-3 border-b border-[#D9E2EC] pb-4">
              <JobImage src={job.imageUrl} title={job.title} alt={job.title} size="md" />
              <div>
                <h3 className="text-sm font-semibold text-[#102A43]">
                  Role Summary
                </h3>
                {job.department && (
                  <div className="text-xs text-[#627D98]">{job.department}</div>
                )}
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <Banknote className="w-4 h-4 text-[#0B315D] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Monthly Compensation</div>
                  <div className="text-[#0B315D] font-bold text-sm mt-0.5 font-mono">
                    {salaryDisplay}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Employment Type</div>
                  <div className="text-[#102A43] font-medium text-xs mt-0.5">{employmentTypeDisplay}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Work Arrangement</div>
                  <div className="text-[#102A43] font-medium text-xs mt-0.5">{workArrangementDisplay}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Position Status</div>
                  <div className="text-[#102A43] font-semibold text-xs mt-0.5">
                    <span className="inline-block px-2 py-0.5 rounded bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] text-[11px]">
                      {job.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Job Location</div>
                  <div className="text-[#102A43] font-medium text-xs mt-0.5">{job.location || "Nationwide"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-[#627D98] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#627D98] text-[11px] font-medium">Posted Date</div>
                  <div className="text-[#102A43] font-medium text-xs mt-0.5">{formatDate(job.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D9E2EC]">
              {job.alreadyApplied ? (
                <Link to="/app/applications" className="block w-full">
                  <Button variant="outline" size="md" className="w-full" leftIcon={<CheckCircle2 className="w-4 h-4 text-[#047857]" />}>
                    Track Application
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={() => setApplyModalOpen(true)}
                >
                  Apply for this job
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
            <div className="w-12 h-12 rounded-full bg-[#ECFDF5] text-[#047857] flex items-center justify-center mx-auto border border-[#047857]/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-[#102A43]">Application Submitted</h4>
              <p className="text-xs text-[#627D98] leading-relaxed max-w-sm mx-auto">
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
            <div className="p-3 bg-[#F7F9FC] border border-[#D9E2EC] rounded-lg text-xs text-[#102A43] space-y-1">
              <div className="font-semibold text-[#102A43]">Applicant Profile Information:</div>
              <p>
                Your saved education, work experience, and character references will automatically be attached to this job application.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#102A43]">
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
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          notify.error("File Too Large", "Maximum PDF upload size is 5 MB. Please select a smaller file.");
                          return;
                        }
                        setCustomResume(file);
                      }
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9E2EC] bg-white hover:bg-[#F7F9FC] text-xs font-semibold text-[#102A43] shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{customResume ? "Replace PDF" : "Attach Tailored Resume (PDF up to 5 MB)"}</span>
                  </span>
                </label>
                {customResume && (
                  <span className="text-xs font-mono text-[#0B315D] font-medium flex items-center gap-1 truncate max-w-[200px]">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {customResume.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#627D98]">
                If omitted, your active profile resume on file will be used.
              </p>
            </div>

            {applyMutation.isError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#DC2626]/30 rounded-lg flex items-center gap-2 text-xs text-[#DC2626]">
                <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                <span>
                  {formatErrorMessage(applyMutation.error)}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E2EC]">
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
