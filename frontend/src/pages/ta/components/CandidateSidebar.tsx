import { Mail, Phone, MapPin, Briefcase, Calendar, Download } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ScoreBadge } from '../../../components/common/ScoreBadge';
import { PipelineIndicator } from '../../../components/common/PipelineIndicator';
import { StatusActionBar } from './StatusActionBar';
import type { ApplicationDetail } from '../../../lib/types/api';

interface CandidateSidebarProps {
  application: ApplicationDetail;
  onOpenScheduleInterview?: (type: 'INITIAL_SCREENING' | 'FINAL_INTERVIEW') => void;
  onOpenEndorsement?: () => void;
  onOpenDeployModal?: () => void;
  onOpenComplianceUpload?: () => void;
}

export function CandidateSidebar({
  application,
  onOpenScheduleInterview,
  onOpenEndorsement,
  onOpenDeployModal,
  onOpenComplianceUpload,
}: CandidateSidebarProps) {
  const profile = application.user.applicantProfile;
  const fullName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : application.user.email.split('@')[0];
  const initials = profile
    ? `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase()
    : 'CA';

  const location = profile?.city && profile?.province
    ? `${profile.city}, ${profile.province}`
    : profile?.city || profile?.province || application.jobPosting.location || 'Location Not Specified';

  const formatDate = (dateStr: string) => {
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

  const handleDownloadResume = () => {
    if (application.resumeUrl) {
      window.open(application.resumeUrl, '_blank');
      return;
    }
    const resumeAsset = profile?.assets?.find(
      (a) => a.documentType === 'RESUME' || a.label?.toLowerCase().includes('resume')
    );
    if (resumeAsset?.fileUrl) {
      window.open(resumeAsset.fileUrl, '_blank');
    } else {
      window.open(`/api/documents/${application.id}/download`, '_blank');
    }
  };

  return (
    <aside
      className="w-full lg:w-72 lg:shrink-0 bg-card border border-border rounded-xl p-6 shadow-subtle flex flex-col justify-between space-y-6"
      data-testid="candidate-sidebar"
    >
      <div className="space-y-6">
        {/* Candidate Avatar & Basic Info */}
        <div className="flex flex-col items-center text-center space-y-3 pb-5 border-b border-border">
          {profile?.photoUrl ? (
            <img
              src={profile.photoUrl}
              alt={fullName}
              className="w-16 h-16 rounded-full object-cover border border-teal-200 shadow-subtle shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-teal-100 text-teal-800 text-xl font-bold border border-teal-200 flex items-center justify-center shrink-0 shadow-subtle">
              {initials}
            </div>
          )}

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground leading-tight tracking-tight" data-testid="sidebar-candidate-name">
              {fullName}
            </h2>
            <div className="text-sm font-medium text-teal-800 flex items-center justify-center gap-1.5">
              <Briefcase className="w-4 h-4 text-teal-700 shrink-0" />
              <span>{application.jobPosting.title}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              APP-#{application.id} &bull; Job #{application.jobPostingId}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <StatusBadge status={application.status} size="sm" />
            <ScoreBadge score={application.aiScore} size="sm" showIcon />
          </div>

          {/* Quick Resume Download Action */}
          <button
            type="button"
            onClick={handleDownloadResume}
            data-testid="sidebar-download-resume-btn"
            className="h-10 px-4 text-sm font-semibold w-full rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 inline-flex items-center justify-center gap-2 text-slate-800 transition-colors cursor-pointer mt-2"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Download Resume</span>
          </button>
        </div>

        {/* Contact Coordinates */}
        <div className="space-y-3 pb-5 border-b border-border">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Contact Details
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 truncate text-sm font-medium text-foreground/80">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate" title={application.user.email}>
                {application.user.email}
              </span>
            </div>

            {profile?.mobileNumber && (
              <div className="flex items-center gap-2.5 truncate text-sm font-medium text-foreground/80">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{profile.mobileNumber}</span>
              </div>
            )}

            <div className="flex items-center gap-2.5 truncate text-sm font-medium text-foreground/80">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{location}</span>
            </div>

            <div className="flex items-center gap-2.5 truncate text-sm font-medium text-foreground/80">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Applied: {formatDate(application.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Vertical Pipeline Progress */}
        <div className="space-y-3 pb-5 border-b border-border">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Stage Progression
          </div>
          <PipelineIndicator currentStatus={application.status} variant="vertical" />
        </div>
      </div>

      {/* Contextual Status Action Buttons */}
      <StatusActionBar
        application={application}
        onOpenScheduleInterview={onOpenScheduleInterview}
        onOpenEndorsement={onOpenEndorsement}
        onOpenDeployModal={onOpenDeployModal}
        onOpenComplianceUpload={onOpenComplianceUpload}
      />
    </aside>
  );
}
