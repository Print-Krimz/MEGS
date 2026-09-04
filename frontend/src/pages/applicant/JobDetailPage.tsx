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
  FileText,
  Briefcase,
  Bookmark,
  Building2,
  ShieldCheck,
  DollarSign,
  ArrowLeft,
  Check,
} from "lucide-react";
import { notify } from "../../lib/feedback";
import { AuthContext } from "../../context/AuthContext";
import { GuestApplyModal } from "../../components/applicant/GuestApplyModal";

export const JobDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { jobId } = useParams({ strict: false }) as { jobId: string };

  const auth = React.useContext(AuthContext);
  const isAuthenticated = Boolean(auth?.isAuthenticated);

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
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
    enabled: isAuthenticated,
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
    if (!isAuthenticated) {
      setGuestModalOpen(true);
      return;
    }

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
    onError: (err: any) => {
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

  const handleApplyButtonClick = () => {
    if (!isAuthenticated) {
      setGuestModalOpen(true);
      return;
    }
    setApplyModalOpen(true);
  };

  if (jobQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Details" description="Loading position details…" />
        <LoadingState variant="detail" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Job Details" description="Position details" />
        <ErrorState error={jobQuery.error} onRetry={() => jobQuery.refetch()} />
      </div>
    );
  }

  const job = jobQuery.data;
  const companyName = (job as any).client?.name || (job as any).company || "MAR Employment (MEGS)";
  const workSetup = (job as any).workSetup || "ON_SITE";
  const salaryRange = (job as any).salaryRange;
  const employmentType = (job as any).employmentType || "Full-time";

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link
          to={isAuthenticated ? "/app/jobs" : "/jobs"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Openings</span>
        </Link>
      </div>

      {/* Main Hero Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{companyName}</span>
              <span className="text-blue-600" title="Verified Employer">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {job.title}
            </h1>

            {/* Badges Ribbon */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{job.location || "Philippines"}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-medium">
                <Briefcase className="w-3.5 h-3.5" />
                <span>{workSetup === "ON_SITE" ? "On-site" : workSetup === "HYBRID" ? "Hybrid" : "Remote"}</span>
              </span>

              <span className="inline-flex items-center px-3 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                {employmentType}
              </span>

              {salaryRange && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{salaryRange}</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 text-slate-500 pl-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Posted {formatDate(job.createdAt)}</span>
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex sm:flex-col items-center sm:items-end gap-2.5 shrink-0">
            {job.alreadyApplied ? (
              <Link to="/app/applications">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                >
                  Application Submitted
                </Button>
              </Link>
            ) : (
              <Button
                variant="primary"
                size="md"
                leftIcon={<Send className="w-4 h-4" />}
                onClick={handleApplyButtonClick}
                className="w-full sm:w-auto"
              >
                Apply for this Position
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              leftIcon={<Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-600 text-blue-600" : ""}`} />}
              onClick={handleToggleSave}
              className="w-full sm:w-auto"
            >
              {isSaved ? "Saved" : "Save for Later"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Description (Left) + Metadata (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Role Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Position Overview */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Position Overview
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.description}
            </div>
          </div>

          {/* Requirements */}
          {job.requirements && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Key Requirements & Qualifications
              </h3>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {job.requirements}
              </div>
            </div>
          )}

          {/* Candidate Protection Banner */}
          <div className="bg-blue-50/60 rounded-xl border border-blue-200 p-5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 space-y-1">
              <div className="font-bold">Legitimate & Safe Recruitment</div>
              <p className="leading-relaxed">
                MAR Employment is a DOLE-licensed Private Employment Agency. We never charge placement fees to applicants. All candidate assessments and hiring workflows are conducted transparently.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar Summary & Company Card */}
        <div className="space-y-6">
          {/* Quick Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Position Summary
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500 font-medium">Employer</div>
                  <div className="font-bold text-slate-900 mt-0.5">{companyName}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500 font-medium">Work Location</div>
                  <div className="font-bold text-slate-900 mt-0.5">{job.location || "Philippines"}</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500 font-medium">Work Setup & Schedule</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {workSetup === "ON_SITE" ? "On-site" : workSetup === "HYBRID" ? "Hybrid" : "Remote"} • {employmentType}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-slate-500 font-medium">Date Posted</div>
                  <div className="font-bold text-slate-900 mt-0.5">{formatDate(job.createdAt)}</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={handleApplyButtonClick}
                disabled={job.alreadyApplied}
              >
                {job.alreadyApplied ? "Already Applied" : "Apply Now"}
              </Button>
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900">Application Tips</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>Keep your phone number updated in your profile so recruiters can reach you promptly.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span>Attach a tailored PDF resume to highlight relevant machinery or technical experience.</span>
              </li>
            </ul>
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
                Your application has been received and is now queued for recruiter evaluation.
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
            <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-slate-700 space-y-1">
              <div className="font-semibold text-blue-900">Candidate Profile Attached:</div>
              <p>
                Your saved credentials, work experience, and character references will automatically be attached to this application.
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
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          notify.error("File Too Large", "Resume must be under 5MB.");
                          return;
                        }
                        setCustomResume(file);
                      }
                    }}
                  />
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{customResume ? "Change PDF" : "Upload Tailored PDF"}</span>
                  </div>
                </label>
                {customResume && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>{customResume.name}</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-400">If omitted, your default profile resume will be used.</p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setApplyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={applyMutation.isPending}
                leftIcon={<Send className="w-3.5 h-3.5" />}
              >
                Submit Application
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* Guest Apply Intercept Modal */}
      <GuestApplyModal
        open={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        jobId={Number(jobId)}
        jobTitle={job.title}
      />
    </div>
  );
};
