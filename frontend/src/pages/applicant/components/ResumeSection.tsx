import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { applicantApi } from '../../../lib/api/applicant';
import type { ApplicantProfile } from '../../../lib/types/api';

interface ResumeSectionProps {
  profile?: ApplicantProfile | null;
}

export function ResumeSection({ profile }: ResumeSectionProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasConsent = Boolean(profile?.hasConsentedToAi);
  const currentResumeUrl = profile?.resumeUrl;

  const consentMutation = useMutation({
    mutationFn: (consent: boolean) => applicantApi.setAiConsent(consent),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success(
        res.data?.hasConsentedToAi
          ? 'AI data processing consent granted'
          : 'AI data processing consent withdrawn'
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update AI consent');
    },
  });

  const resumeUploadMutation = useMutation({
    mutationFn: (file: File) => applicantApi.uploadResume(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant', 'profile'] });
      toast.success('Resume uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload resume');
    },
  });

  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF documents are supported for resume upload');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Resume PDF file size must be less than 10MB');
      return;
    }

    if (!hasConsent) {
      toast.error('Please consent to AI processing below before uploading a resume');
      return;
    }

    resumeUploadMutation.mutate(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="resume-section">
      {/* 1. AI Consent Box */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h4 className="text-base font-bold text-foreground">
                  AI-Powered Resume Analysis &amp; Job Matching Consent
                </h4>
                {hasConsent ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Consent Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Consent Required
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">
                MEGS uses artificial intelligence to parse your resume, match your skills and experience
                against client job requirements, and calculate candidate fit scores. By toggling consent,
                you authorize the automated parsing and scoring of your submitted resumes.
              </p>
            </div>
          </div>

          {/* Toggle Consent Action Button */}
          <div className="flex items-center gap-3 flex-shrink-0 self-start sm:self-center">
            <button
              type="button"
              role="switch"
              aria-checked={hasConsent}
              onClick={() => consentMutation.mutate(!hasConsent)}
              disabled={consentMutation.isPending}
              data-testid="ai-consent-toggle"
              className={`h-10 px-5 text-sm font-semibold rounded-xl transition duration-150 inline-flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 ${
                hasConsent
                  ? 'bg-teal-700 text-white hover:bg-teal-800'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {consentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : hasConsent ? (
                <CheckCircle2 className="w-4 h-4 text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-teal-700" />
              )}
              <span>{hasConsent ? 'Consent Granted' : 'Grant AI Consent'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Current Resume Status & PDF Upload */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-700" />
            <div>
              <h4 className="text-base font-bold text-foreground">Default Central Resume</h4>
              <p className="text-xs text-muted-foreground">
                This resume will be automatically attached to one-click job applications unless a customized version is provided.
              </p>
            </div>
          </div>
        </div>

        {/* Existing Resume Banner */}
        {currentResumeUrl ? (
          <div className="p-5 rounded-xl bg-teal-50/60 border border-teal-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-teal-700 text-white rounded-xl shadow-sm">
                <FileCheck className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-teal-950 flex items-center gap-2">
                  <span>Current Resume On File</span>
                  <span className="px-2.5 py-0.5 rounded text-xs font-mono bg-teal-200 text-teal-900 font-bold uppercase">
                    PDF
                  </span>
                </div>
                <p className="text-xs text-teal-800 font-medium">
                  Ready for instant job applications and AI parsing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={currentResumeUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="view-resume-link"
                className="h-9 px-4 rounded-lg text-xs font-semibold text-teal-800 bg-white border border-teal-300 hover:bg-teal-100/50 transition duration-150 inline-flex items-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>View / Download</span>
              </a>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={resumeUploadMutation.isPending || !hasConsent}
                className="h-9 px-4 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {resumeUploadMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" />
                )}
                <span>Replace Resume</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="text-sm text-slate-600">
              No default resume uploaded yet. Upload a PDF below to enable 1-click job submissions.
            </div>
          </div>
        )}

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!hasConsent) {
              toast.error('Please consent to AI processing first before uploading');
              return;
            }
            fileInputRef.current?.click();
          }}
          data-testid="resume-dropzone"
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
            isDragging
              ? 'border-teal-600 bg-teal-50/50 scale-[1.01]'
              : 'border-slate-300 hover:border-teal-500 hover:bg-slate-50/70'
          } ${!hasConsent ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
            {resumeUploadMutation.isPending ? (
              <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
            ) : (
              <UploadCloud className="w-6 h-6 text-teal-700" />
            )}
          </div>
          <h5 className="text-base font-bold text-foreground">
            {resumeUploadMutation.isPending ? 'Uploading resume...' : 'Drop your resume PDF here, or click to browse'}
          </h5>
          <p className="text-sm text-slate-600 mt-1">
            Supports standard PDF files up to 10MB
          </p>
          {!hasConsent && (
            <p className="text-xs font-semibold text-amber-600 mt-2">
              Note: Enable AI Consent above to activate resume upload
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            data-testid="resume-file-input"
          />
        </div>
      </div>
    </div>
  );
}
