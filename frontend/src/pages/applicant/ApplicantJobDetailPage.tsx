import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase,
  MapPin,
  Calendar,
  CheckCircle2,
  FileText,
  UploadCloud,
  Loader2,
  X,
  ExternalLink,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { applicantApi } from '../../lib/api/applicant';
import type { JobPosting, Application } from '../../lib/types/api';

export default function ApplicantJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const jobId = id ? parseInt(id, 10) : NaN;

  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [resumeMode, setResumeMode] = useState<'profile' | 'custom'>('profile');
  const [customFile, setCustomFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Job Details
  const {
    data: jobRes,
    isLoading: isJobLoading,
    isError: isJobError,
    error: jobError,
    refetch,
  } = useQuery({
    queryKey: ['applicant', 'jobs', jobId],
    queryFn: () => applicantApi.getJobDetails(jobId),
    enabled: !isNaN(jobId),
  });

  // 2. Fetch User Profile (to get default resume & AI consent)
  const { data: profileRes } = useQuery({
    queryKey: ['applicant', 'profile'],
    queryFn: () => applicantApi.getProfile(),
  });

  // 3. Fetch Applications (to check if already applied)
  const { data: appsRes } = useQuery({
    queryKey: ['applicant', 'applications'],
    queryFn: () => applicantApi.getMyApplications(),
  });

  const job = jobRes?.data as (JobPosting & { alreadyApplied?: boolean; hasApplied?: boolean }) | undefined;
  const profile = profileRes?.data;
  const applications: Application[] = appsRes?.data || [];

  // Determine existing application for this job
  const existingApp = applications.find(
    (app) => (app.jobPostingId === jobId || app.jobPosting?.id === jobId)
  );
  const hasApplied = Boolean(existingApp || job?.alreadyApplied || job?.hasApplied);

  const hasConsent = Boolean(profile?.hasConsentedToAi);
  const hasProfileResume = Boolean(profile?.resumeUrl);

  // Consent mutation
  const consentMutation = useMutation({
    mutationFn: (consent: boolean) => applicantApi.setAiConsent(consent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('AI processing consent granted');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update consent');
    },
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: (fileToUse?: File) => applicantApi.applyToJob(jobId, fileToUse),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicant', 'jobs'] });
      toast.success('Application submitted successfully!');
      setIsApplyModalOpen(false);
      navigate('/app/applications');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to submit application');
    },
  });

  const handleApplySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasConsent) {
      toast.error('Please consent to AI resume processing before applying');
      return;
    }

    if (resumeMode === 'profile') {
      if (!hasProfileResume) {
        toast.error('You do not have a default resume uploaded in your profile. Please upload one below.');
        setResumeMode('custom');
        return;
      }
      applyMutation.mutate(undefined);
    } else {
      if (!customFile) {
        toast.error('Please select a PDF resume file to attach');
        return;
      }
      applyMutation.mutate(customFile);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (isNaN(jobId) || isJobError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Job Posting Details"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Jobs', href: '/app/jobs' },
            { label: 'Details' },
          ]}
        />
        <ErrorState
          title="Job Posting Not Found"
          message={jobError instanceof Error ? jobError.message : 'This job vacancy may have closed or does not exist.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (isJobLoading || !job) {
    return <LoadingState variant="page" />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="applicant-job-detail-page">
      {/* Back Link */}
      <div>
        <Link
          to="/app/jobs"
          className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 transition duration-150"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to All Open Jobs</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                Verified Position
              </span>
              <StatusBadge status={job.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {job.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <MapPin className="w-4 h-4 text-teal-700" />
                {job.location || 'Metro Manila, Philippines'}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <Calendar className="w-4 h-4 text-teal-700" />
                Posted on {formatDate(job.createdAt)}
              </span>
            </div>
          </div>

          {/* Action Header Button / Status Banner */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {hasApplied ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">Application Active</div>
                  <div className="text-[11px] text-emerald-800">You have already applied to this position.</div>
                </div>
                {existingApp && (
                  <Link
                    to={`/app/applications/${existingApp.id}`}
                    data-testid="view-submitted-app-link"
                    className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition duration-150 inline-flex items-center gap-1"
                  >
                    <span>View Application</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(true)}
                data-testid="apply-for-job-btn"
                className="px-6 py-3 rounded-xl font-bold text-sm text-white bg-teal-700 hover:bg-teal-800 shadow-md hover:shadow-lg transition duration-150 inline-flex items-center justify-center gap-2"
              >
                <Briefcase className="w-4 h-4" />
                <span>Apply for this Position</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Already Applied Alert Banner (if applied) */}
      {hasApplied && existingApp && (
        <div
          data-testid="already-applied-banner"
          className="p-4 bg-teal-50/70 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-700 text-white flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-teal-950">You submitted an application for this role</h4>
              <p className="text-xs text-teal-800">
                Current status: <strong>{existingApp.status.replace('_', ' ')}</strong>. Monitor updates in your applications dashboard.
              </p>
            </div>
          </div>
          <Link
            to={`/app/applications/${existingApp.id}`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-teal-900 bg-white border border-teal-300 hover:bg-teal-100 transition duration-150 inline-flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Track Progress</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Job Description & Requirements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Job Description */}
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-subtle space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Briefcase className="w-5 h-5 text-teal-700" />
              <span>Job Description &amp; Responsibilities</span>
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.description || 'No detailed description provided for this requisition.'}
            </div>
          </div>

          {/* Key Qualifications & Requirements */}
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-subtle space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <CheckCircle2 className="w-5 h-5 text-teal-700" />
              <span>Qualifications &amp; Requirements</span>
            </h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {job.requirements || 'No specific requirements listed for this opening.'}
            </div>
          </div>
        </div>

        {/* Sidebar Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
            <h4 className="text-sm font-bold text-foreground border-b border-border pb-3">
              Position Overview
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Job Requisition ID</span>
                <span className="font-mono font-semibold text-foreground">#{job.id}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Work Site Location</span>
                <span className="font-semibold text-foreground">{job.location || 'Metro Manila'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Posting Date</span>
                <span className="font-semibold text-foreground">{formatDate(job.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Employment Status</span>
                <span className="font-semibold text-foreground">Active &bull; Accepting Applications</span>
              </div>
            </div>

            {!hasApplied && (
              <div className="pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(true)}
                  className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 shadow-sm transition duration-150 inline-flex items-center justify-center gap-2"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Apply Now</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {isApplyModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 id="apply-modal-title" className="text-base font-bold text-foreground">
                  Apply for {job.title}
                </h3>
                <p className="text-xs text-muted-foreground">Submit your application to recruiter review</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-5" data-testid="apply-job-form">
              {/* AI Consent Check */}
              {!hasConsent && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-amber-950">AI Parsing Consent Required</h5>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        To submit your application, you must consent to our automated AI parsing and matching engine.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => consentMutation.mutate(true)}
                    disabled={consentMutation.isPending}
                    data-testid="grant-consent-apply-btn"
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white transition duration-150 inline-flex items-center gap-1"
                  >
                    {consentMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Grant AI Consent</span>
                  </button>
                </div>
              )}

              {/* Resume Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-foreground">
                  Select Resume to Submit
                </label>

                {/* Option 1: Profile Resume */}
                <div
                  onClick={() => setResumeMode('profile')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-3 ${
                    resumeMode === 'profile'
                      ? 'border-teal-700 bg-teal-50/50 ring-2 ring-teal-200'
                      : 'border-border hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resumeMode"
                    value="profile"
                    checked={resumeMode === 'profile'}
                    onChange={() => setResumeMode('profile')}
                    className="mt-0.5 text-teal-700 focus:ring-teal-600"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-teal-700" />
                        Use Default Profile Resume
                      </span>
                      {hasProfileResume ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          On File
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800">
                          Not Uploaded
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {hasProfileResume
                        ? 'Uses your central PDF resume stored on your candidate profile'
                        : 'No profile resume found. Upload a custom resume below or update your profile.'}
                    </p>
                  </div>
                </div>

                {/* Option 2: Custom Resume for this Job */}
                <div
                  onClick={() => setResumeMode('custom')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-150 flex items-start gap-3 ${
                    resumeMode === 'custom'
                      ? 'border-teal-700 bg-teal-50/50 ring-2 ring-teal-200'
                      : 'border-border hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="resumeMode"
                    value="custom"
                    checked={resumeMode === 'custom'}
                    onChange={() => setResumeMode('custom')}
                    className="mt-0.5 text-teal-700 focus:ring-teal-600"
                  />
                  <div className="space-y-2 flex-1">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <UploadCloud className="w-3.5 h-3.5 text-teal-700" />
                      Upload a Tailored Resume (PDF)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Attach a custom resume specifically formatted for this job opening.
                    </p>

                    {resumeMode === 'custom' && (
                      <div className="pt-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
                                toast.error('Only PDF documents are supported');
                                return;
                              }
                              setCustomFile(file);
                            }
                          }}
                          data-testid="job-custom-resume-input"
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                        {customFile && (
                          <div className="mt-1.5 text-xs text-teal-800 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                            <span>Attached: {customFile.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={applyMutation.isPending || !hasConsent}
                  data-testid="submit-application-btn"
                  className="px-5 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {applyMutation.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>Submit Application</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export { ApplicantJobDetailPage as JobDetailPage };
