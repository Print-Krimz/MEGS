import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  CheckCircle2, 
  Plus, 
  FileText, 
  Calendar,
  X
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { taApi } from '../../../lib/api/ta';
import type { ApplicationDetail, ComplianceRequirement } from '../../../lib/types/api';

interface ComplianceTabProps {
  application: ApplicationDetail;
}

export function ComplianceTab({ application }: ComplianceTabProps) {
  const queryClient = useQueryClient();

  // Modal states
  const [isAddReqOpen, setIsAddReqOpen] = useState(false);
  const [selectedReqForUpload, setSelectedReqForUpload] = useState<ComplianceRequirement | null>(null);
  const [selectedReqForReview, setSelectedReqForReview] = useState<ComplianceRequirement | null>(null);

  // Add requirement form
  const [documentLabel, setDocumentLabel] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [deadline, setDeadline] = useState('');

  // Upload document form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Review document form
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // 1. Query Requirements
  const {
    data: reqsRes,
    isLoading,
  } = useQuery({
    queryKey: ['ta', 'compliance', application.id],
    queryFn: () => taApi.listRequirements(application.id),
  });

  const requirements: ComplianceRequirement[] =
    reqsRes?.data || application.complianceRequirements || [];

  // 2. Mutation: Create Requirement
  const createReqMutation = useMutation({
    mutationFn: () =>
      taApi.createRequirement(application.id, {
        documentLabel,
        isRequired,
        deadline: deadline || undefined,
      }),
    onSuccess: () => {
      toast.success('Compliance requirement added');
      setIsAddReqOpen(false);
      setDocumentLabel('');
      setDeadline('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'compliance', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to add requirement');
    },
  });

  // 3. Mutation: Upload Document on Behalf of Applicant
  const uploadDocMutation = useMutation({
    mutationFn: () => {
      if (!selectedReqForUpload || !selectedFile) {
        throw new Error('Please select a file to upload');
      }
      return taApi.submitDocument(selectedReqForUpload.id, selectedFile);
    },
    onSuccess: () => {
      toast.success('Document uploaded for review');
      setSelectedReqForUpload(null);
      setSelectedFile(null);
      queryClient.invalidateQueries({ queryKey: ['ta', 'compliance', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to upload document');
    },
  });

  // 4. Mutation: Review Requirement (Approve / Reject)
  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!selectedReqForReview) throw new Error('No requirement selected');
      return taApi.reviewRequirement(selectedReqForReview.id, {
        reviewStatus,
        reviewNotes,
        expiresAt: expiresAt || undefined,
      });
    },
    onSuccess: () => {
      toast.success(`Compliance document marked as ${reviewStatus}`);
      setSelectedReqForReview(null);
      setReviewNotes('');
      setExpiresAt('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'compliance', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update compliance review');
    },
  });

  // Calculate compliance health
  const requiredReqs = requirements.filter((r) => r.isRequired);
  const approvedReqs = requiredReqs.filter((r) => r.reviewStatus === 'APPROVED');
  const isFullyCompliant =
    requiredReqs.length > 0 && approvedReqs.length === requiredReqs.length;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" data-testid="compliance-tab">
      {/* 1. Overall Compliance Readiness Banner */}
      <div
        data-testid="compliance-status-banner"
        className={`p-5 rounded-xl border shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isFullyCompliant
            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
            : 'bg-amber-50/80 border-amber-300 text-amber-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-lg ${
              isFullyCompliant
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {isFullyCompliant ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold">
              {isFullyCompliant
                ? 'Candidate 100% Pre-Employment Compliant'
                : 'Mandatory Compliance In Progress'}
            </h3>
            <p className="text-xs opacity-90">
              {isFullyCompliant
                ? 'All required statutory and client documents have been verified and approved. Ready for deployment.'
                : `${approvedReqs.length} of ${requiredReqs.length} mandatory documents approved. Verification pending.`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddReqOpen(true)}
          data-testid="add-requirement-btn"
          className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 flex items-center gap-1.5 self-start sm:self-auto shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Requirement</span>
        </button>
      </div>

      {/* 2. Requirements Checklist Table */}
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="compliance-checklist">
        <div className="p-4 border-b border-border bg-slate-50/80 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <span>Statutory & Onboarding Document Checklist</span>
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            {requirements.length} total items
          </span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          </div>
        ) : requirements.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No compliance requirements mapped to this candidate or job posting. Click "Add Requirement" to assign statutory documents.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {requirements.map((req) => (
              <div
                key={req.id}
                data-testid={`compliance-req-item-${req.id}`}
                className="py-4 px-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-foreground text-sm">
                      {req.documentLabel}
                    </span>
                    {req.isRequired && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 font-mono">
                        Mandatory
                      </span>
                    )}
                    <span className="text-xs font-medium px-3 py-1">
                      <StatusBadge status={req.reviewStatus} size="sm" />
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
                    {req.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Deadline: <strong className="text-foreground">{formatDate(req.deadline)}</strong>
                      </span>
                    )}
                    {req.reviewedBy && (
                      <span>
                        Reviewed by: <strong className="text-foreground">{req.reviewedBy.email}</strong>
                      </span>
                    )}
                    {req.expiresAt && (
                      <span>
                        Expires: <strong className="text-foreground">{formatDate(req.expiresAt)}</strong>
                      </span>
                    )}
                  </div>

                  {req.reviewNotes && (
                    <p className="text-xs text-slate-700 dark:text-slate-300 italic pt-0.5">
                      Notes: "{req.reviewNotes}"
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReqForUpload(req);
                      setSelectedFile(null);
                    }}
                    data-testid={`upload-doc-btn-${req.id}`}
                    className="h-9 px-3.5 text-xs font-semibold rounded-lg text-teal-900 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReqForReview(req);
                      setReviewStatus('APPROVED');
                      setReviewNotes('');
                    }}
                    data-testid={`review-doc-btn-${req.id}`}
                    className="h-9 px-3.5 text-xs font-semibold rounded-lg text-slate-800 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>Review</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Add Compliance Requirement */}
      {isAddReqOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-700" />
                <span>Add Compliance Requirement</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddReqOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!documentLabel.trim()) {
                  toast.error('Document label is required');
                  return;
                }
                createReqMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="add-requirement-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Document Label / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={documentLabel}
                  onChange={(e) => setDocumentLabel(e.target.value)}
                  placeholder="e.g. NBI Clearance, Medical Fit-to-Work, SSS E1, Pag-IBIG MID"
                  data-testid="req-document-label-input"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="req-is-mandatory"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-border text-teal-700 focus:ring-teal-600"
                />
                <label htmlFor="req-is-mandatory" className="font-semibold text-foreground cursor-pointer text-xs">
                  Mandatory for deployment dispatch
                </label>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Submission Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddReqOpen(false)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReqMutation.isPending}
                  data-testid="submit-add-requirement-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {createReqMutation.isPending ? 'Adding...' : 'Save Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Upload Document on Behalf of Applicant */}
      {selectedReqForUpload && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-teal-700" />
                <span>Upload Document File</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReqForUpload(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedFile) {
                  toast.error('Please choose a file');
                  return;
                }
                uploadDocMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="upload-document-form"
            >
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border">
                <div className="text-muted-foreground text-xs">Uploading for requirement:</div>
                <div className="font-bold text-foreground text-sm">
                  {selectedReqForUpload.documentLabel}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Select Document (PDF, JPG, PNG) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="compliance-file-input"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedReqForUpload(null)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadDocMutation.isPending}
                  data-testid="submit-compliance-upload-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {uploadDocMutation.isPending ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Recruiter Document Review Action */}
      {selectedReqForReview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>Verify Compliance Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedReqForReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                reviewMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="review-requirement-form"
            >
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border">
                <div className="text-muted-foreground text-xs">Reviewing Requirement:</div>
                <div className="font-bold text-foreground text-sm">
                  {selectedReqForReview.documentLabel}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Review Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    data-testid="review-approve-btn"
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition duration-150 cursor-pointer ${
                      reviewStatus === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    APPROVED
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('REJECTED')}
                    data-testid="review-reject-btn"
                    className={`py-2 px-3 rounded-lg border text-center font-bold transition duration-150 cursor-pointer ${
                      reviewStatus === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    REJECTED
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Document Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Reviewer Audit Notes / Rejection Reason
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Validated against statutory registry, clear seal, or blurry copy..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedReqForReview(null)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  data-testid="submit-compliance-review-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {reviewMutation.isPending ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
