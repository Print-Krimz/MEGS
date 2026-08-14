import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  ArrowRightCircle, 
  Archive, 
  RotateCcw, 
  Users, 
  CheckCircle2, 
  Calendar, 
  Send, 
  ShieldCheck, 
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import { taApi } from '../../../lib/api/ta';
import { ApplicationStatus, ALLOWED_TRANSITIONS } from '../../../lib/types/enums';
import type { ApplicationDetail } from '../../../lib/types/api';

interface StatusActionBarProps {
  application: ApplicationDetail;
  onOpenScheduleInterview?: (type: 'INITIAL_SCREENING' | 'FINAL_INTERVIEW') => void;
  onOpenEndorsement?: () => void;
  onOpenDeployModal?: () => void;
  onOpenComplianceUpload?: () => void;
}

export function StatusActionBar({
  application,
  onOpenScheduleInterview,
  onOpenEndorsement,
  onOpenDeployModal,
}: StatusActionBarProps) {
  const queryClient = useQueryClient();
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isTalentPoolOpen, setIsTalentPoolOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  const currentStatus = application.status;
  const isArchived = application.isArchived || currentStatus === ApplicationStatus.ARCHIVED;
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];

  // Status transition mutation
  const statusMutation = useMutation({
    mutationFn: ({ status, reason }: { status: ApplicationStatus; reason?: string }) =>
      taApi.updateApplicationStatus(application.id, status, reason),
    onSuccess: (_, variables) => {
      toast.success(`Application moved to ${variables.status.replace(/_/g, ' ')}`);
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update application status');
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: () => taApi.archiveApplication(application.id, archiveReason),
    onSuccess: () => {
      toast.success('Application moved to archive');
      setIsArchiveOpen(false);
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to archive application');
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: () => taApi.restoreApplication(application.id),
    onSuccess: () => {
      toast.success('Application restored to pipeline');
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to restore application');
    },
  });

  const handleTransition = (nextStatus: ApplicationStatus, reason?: string) => {
    statusMutation.mutate({ status: nextStatus, reason });
  };

  const isTransitionAllowed = (status: ApplicationStatus) => allowedNext.includes(status);

  // Check compliance gating: all required documents must be APPROVED
  const requiredComplianceDocs = application.complianceRequirements?.filter((r) => r.isRequired) || [];
  const allRequiredApproved =
    requiredComplianceDocs.length > 0 &&
    requiredComplianceDocs.every((r) => r.reviewStatus === 'APPROVED');

  return (
    <div className="space-y-3 pt-2" data-testid="status-action-bar">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline Actions
      </div>

      {isArchived ? (
        <div className="space-y-2.5">
          <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-700 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>This application is currently archived.</span>
          </div>
          <button
            type="button"
            onClick={() => restoreMutation.mutate()}
            disabled={restoreMutation.isPending}
            data-testid="restore-application-btn"
            className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{restoreMutation.isPending ? 'Restoring...' : 'Restore to Pipeline'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Action 1: Move to Initial Screening / Schedule Screening */}
          {isTransitionAllowed(ApplicationStatus.INITIAL_SCREENING) && (
            <button
              type="button"
              onClick={() => {
                if (onOpenScheduleInterview) {
                  onOpenScheduleInterview('INITIAL_SCREENING');
                } else {
                  handleTransition(ApplicationStatus.INITIAL_SCREENING);
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="action-move-screening-btn"
              className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Screening Interview</span>
            </button>
          )}

          {/* Action 2: Move to Client Endorsement */}
          {isTransitionAllowed(ApplicationStatus.CLIENT_ENDORSEMENT) && (
            <button
              type="button"
              onClick={() => {
                if (onOpenEndorsement) {
                  onOpenEndorsement();
                } else {
                  handleTransition(ApplicationStatus.CLIENT_ENDORSEMENT);
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="action-move-endorsement-btn"
              className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <Send className="w-4 h-4" />
              <span>Endorse to Client</span>
            </button>
          )}

          {/* Action 3: Move to Final Interview */}
          {isTransitionAllowed(ApplicationStatus.FINAL_INTERVIEW) && (
            <button
              type="button"
              onClick={() => {
                if (onOpenScheduleInterview) {
                  onOpenScheduleInterview('FINAL_INTERVIEW');
                } else {
                  handleTransition(ApplicationStatus.FINAL_INTERVIEW);
                }
              }}
              disabled={statusMutation.isPending}
              data-testid="action-move-final-interview-btn"
              className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule Final Interview</span>
            </button>
          )}

          {/* Action 4: Move to Hired */}
          {isTransitionAllowed(ApplicationStatus.HIRED) && (
            <button
              type="button"
              onClick={() => handleTransition(ApplicationStatus.HIRED)}
              disabled={statusMutation.isPending}
              data-testid="action-move-hired-btn"
              className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Candidate as Hired</span>
            </button>
          )}

          {/* Action 5: Move to Compliance */}
          {isTransitionAllowed(ApplicationStatus.COMPLIANCE) && (
            <button
              type="button"
              onClick={() => handleTransition(ApplicationStatus.COMPLIANCE)}
              disabled={statusMutation.isPending}
              data-testid="action-move-compliance-btn"
              className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Initiate Compliance Stage</span>
            </button>
          )}

          {/* Action 6: Deploy Candidate (gated on full compliance or active status) */}
          {isTransitionAllowed(ApplicationStatus.DEPLOYED) && (
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  if (onOpenDeployModal) {
                    onOpenDeployModal();
                  } else {
                    handleTransition(ApplicationStatus.DEPLOYED);
                  }
                }}
                disabled={statusMutation.isPending || (!allRequiredApproved && requiredComplianceDocs.length > 0)}
                data-testid="action-move-deployed-btn"
                className="h-10 px-4 text-sm font-semibold rounded-lg shadow-xs transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 bg-teal-700 hover:bg-teal-800 text-white"
              >
                <Briefcase className="w-4 h-4" />
                <span>Create Client Deployment</span>
              </button>
              {!allRequiredApproved && requiredComplianceDocs.length > 0 && (
                <p className="text-xs text-amber-700 italic">
                  * All required compliance documents must be approved before deployment.
                </p>
              )}
            </div>
          )}

          {/* Action 7: Move to Talent Pool */}
          {isTransitionAllowed(ApplicationStatus.TALENT_POOL) && (
            <button
              type="button"
              onClick={() => setIsTalentPoolOpen(true)}
              disabled={statusMutation.isPending}
              data-testid="action-move-talent-pool-btn"
              className="h-10 px-4 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <Users className="w-4 h-4 text-slate-600" />
              <span>Route to Talent Pool</span>
            </button>
          )}

          {/* Action 8: Move to Review (if from parsing/attention) */}
          {isTransitionAllowed(ApplicationStatus.REVIEW) && currentStatus !== ApplicationStatus.SUBMITTED && (
            <button
              type="button"
              onClick={() => handleTransition(ApplicationStatus.REVIEW)}
              disabled={statusMutation.isPending}
              data-testid="action-move-review-btn"
              className="h-10 px-4 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>Move to Review</span>
            </button>
          )}

          {/* Action 9: Archive Application */}
          {isTransitionAllowed(ApplicationStatus.ARCHIVED) && (
            <button
              type="button"
              onClick={() => setIsArchiveOpen(true)}
              data-testid="action-archive-btn"
              className="h-10 px-4 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center justify-center gap-2 w-full cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Archive Application</span>
            </button>
          )}
        </div>
      )}

      {/* Talent Pool Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isTalentPoolOpen}
        title="Route Candidate to Talent Pool?"
        description="This will place the candidate in the general talent pool for automated matching against future job postings."
        confirmText="Confirm Route"
        variant="primary"
        isLoading={statusMutation.isPending}
        onConfirm={() => {
          handleTransition(ApplicationStatus.TALENT_POOL);
          setIsTalentPoolOpen(false);
        }}
        onCancel={() => setIsTalentPoolOpen(false)}
      />

      {/* Archive Application Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isArchiveOpen}
        title="Archive Candidate Application?"
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to archive this application? The candidate record will be removed from active pipeline views.
            </p>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Reason for archiving (optional):
              </label>
              <input
                type="text"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="e.g. Candidate withdrew, position filled, failed criteria"
                className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
          </div>
        }
        confirmText="Yes, Archive"
        variant="danger"
        isLoading={archiveMutation.isPending}
        onConfirm={() => archiveMutation.mutate()}
        onCancel={() => setIsArchiveOpen(false)}
      />
    </div>
  );
}
