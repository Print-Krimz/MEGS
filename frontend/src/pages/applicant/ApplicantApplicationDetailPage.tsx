import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  Briefcase,
  Clock,
  UserCheck,
  ShieldCheck,
  Building,
  Upload,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PipelineIndicator } from '../../components/common/PipelineIndicator';
import { applicantApi } from '../../lib/api/applicant';
import { ApplicationStatus } from '../../lib/types/enums';
import type { Application, ApplicationDetail } from '../../lib/types/api';

export default function ApplicantApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const appId = id ? parseInt(id, 10) : NaN;

  const {
    data: applicationsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applicant', 'applications'],
    queryFn: () => applicantApi.getMyApplications(),
  });

  const applications: Application[] = applicationsRes?.data || [];
  const application = applications.find((app) => app.id === appId) as
    | (Application & Partial<ApplicationDetail>)
    | undefined;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
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

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getStageGuidance = (status: ApplicationStatus) => {
    switch (status) {
      case ApplicationStatus.SUBMITTED:
        return {
          title: 'Application Successfully Submitted',
          description:
            'Your application has been received and logged in the recruitment system. Our automated parser and recruitment specialists are conducting initial qualification reviews.',
          icon: CheckCircle2,
          bgColor: 'bg-indigo-50 border-indigo-200 text-indigo-900',
        };
      case ApplicationStatus.PARSING:
      case ApplicationStatus.REVIEW:
      case ApplicationStatus.MATCHED:
        return {
          title: 'Application Under Recruiter Review',
          description:
            'Talent Acquisition recruiters are reviewing your profile, work experience, and credentials against the client requisition criteria.',
          icon: Clock,
          bgColor: 'bg-blue-50 border-blue-200 text-blue-900',
        };
      case ApplicationStatus.INITIAL_SCREENING:
        return {
          title: 'Initial Screening Stage',
          description:
            'Congratulations! You have been shortlisted for initial recruiter screening. Keep your phone and email active for interview scheduling.',
          icon: UserCheck,
          bgColor: 'bg-teal-50 border-teal-200 text-teal-900',
        };
      case ApplicationStatus.CLIENT_ENDORSEMENT:
        return {
          title: 'Endorsed to Hiring Client',
          description:
            'Your candidate dossier has been officially endorsed to the hiring client’s hiring manager for evaluation and final interview endorsement.',
          icon: Building,
          bgColor: 'bg-purple-50 border-purple-200 text-purple-900',
        };
      case ApplicationStatus.FINAL_INTERVIEW:
        return {
          title: 'Final Client Interview',
          description:
            'You are scheduled for a final client evaluation interview. Please review the interview schedule and prepare necessary portfolio materials.',
          icon: Briefcase,
          bgColor: 'bg-pink-50 border-pink-200 text-pink-900',
        };
      case ApplicationStatus.HIRED:
      case ApplicationStatus.ONBOARDING:
        return {
          title: 'Selected for Placement & Onboarding',
          description:
            'Congratulations! You have received a job offer. The MEGS HR team will guide you through contract signing and pre-employment onboarding.',
          icon: CheckCircle2,
          bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        };
      case ApplicationStatus.COMPLIANCE:
        return {
          title: 'Pre-Employment Compliance & Clearance Submission',
          description:
            'Please submit all mandatory pre-employment clearances (NBI, Medical, SSS, PhilHealth, Pag-IBIG, TIN) to finalize deployment.',
          icon: ShieldCheck,
          bgColor: 'bg-amber-50 border-amber-200 text-amber-900',
        };
      case ApplicationStatus.DEPLOYED:
        return {
          title: 'Deployed to Client Site',
          description:
            'Your deployment has commenced. You are now an active deployed professional under MEGS Operations.',
          icon: CheckCircle2,
          bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        };
      case ApplicationStatus.TALENT_POOL:
        return {
          title: 'Active in MEGS Talent Pool',
          description:
            'Your profile is indexed in our high-priority Talent Pool. You will receive priority notifications when matching openings arise.',
          icon: UserCheck,
          bgColor: 'bg-cyan-50 border-cyan-200 text-cyan-900',
        };
      case ApplicationStatus.ARCHIVED:
      case ApplicationStatus.BACKOUT:
      default:
        return {
          title: 'Application Concluded',
          description:
            'This application cycle has concluded. We encourage you to explore other open opportunities matching your profile.',
          icon: AlertCircle,
          bgColor: 'bg-slate-50 border-slate-200 text-slate-900',
        };
    }
  };

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isNaN(appId) || isError || !application) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Application Details"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Applications', href: '/app/applications' },
            { label: 'Details' },
          ]}
        />
        <ErrorState
          title="Application Not Found"
          message={error instanceof Error ? error.message : 'Could not find the requested application record.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const guidance = getStageGuidance(application.status);
  const GuidanceIcon = guidance.icon;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="applicant-application-detail-page">
      {/* Back Link */}
      <div>
        <Link
          to="/app/applications"
          className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 transition duration-150"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to All Applications</span>
        </Link>
      </div>

      {/* Header Overview Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-teal-800">
                APPLICATION #{application.id}
              </span>
              <span className="text-slate-300">&bull;</span>
              <StatusBadge status={application.status} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              {application.jobPosting?.title || 'Applied Position'}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              {application.jobPosting?.location && (
                <span className="inline-flex items-center gap-1 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" />
                  {application.jobPosting.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                Submitted on {formatDate(application.createdAt)}
              </span>
            </div>
          </div>

          {/* Quick action buttons */}
          {application.jobPosting?.id && (
            <Link
              to={`/app/jobs/${application.jobPosting.id}`}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition duration-150 inline-flex items-center gap-1.5 self-start shadow-2xs"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>View Job Posting</span>
            </Link>
          )}
        </div>
      </div>

      {/* Interactive Pipeline Indicator */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Recruitment Hiring Pipeline
        </h3>
        <PipelineIndicator currentStatus={application.status} />
      </div>

      {/* Explanatory Stage Guidance Banner */}
      <div
        data-testid="stage-guidance-banner"
        className={`p-5 rounded-xl border flex items-start gap-4 ${guidance.bgColor}`}
      >
        <div className="p-2 rounded-lg bg-white/70 shadow-2xs flex-shrink-0">
          <GuidanceIcon className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold">{guidance.title}</h4>
          <p className="text-xs leading-relaxed">{guidance.description}</p>
        </div>
      </div>

      {/* Details Grid: Interviews, Compliance, and Submitted Resume */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interview Details & Compliance (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Interview Details Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="interview-details-card">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
              <Calendar className="w-4 h-4 text-teal-700" />
              <span>Interview Schedule &amp; Assessment</span>
            </h3>

            {application.interviews && application.interviews.length > 0 ? (
              <div className="space-y-3">
                {application.interviews.map((interview) => (
                  <div
                    key={interview.id}
                    className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground capitalize">
                        {interview.type.replace('_', ' ')} Interview
                      </span>
                      {interview.result && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {interview.result}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>
                        <strong>Scheduled:</strong> {formatDateTime(interview.scheduledAt)}
                      </div>
                      {interview.notes && (
                        <div>
                          <strong>Instructions:</strong> {interview.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-foreground">No interview scheduled yet</p>
                <p className="text-muted-foreground">
                  Our talent acquisition team will notify you via email and portal notification when an interview slot is confirmed.
                </p>
              </div>
            )}
          </div>

          {/* Compliance Requirements Checklist */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="compliance-checklist-card">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>Pre-Employment Requirements Checklist</span>
              </h3>
              <Link
                to="/app/profile"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Documents</span>
              </Link>
            </div>

            {application.complianceRequirements && application.complianceRequirements.length > 0 ? (
              <div className="space-y-2">
                {application.complianceRequirements.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg border border-border flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">{req.documentLabel}</div>
                      {req.isRequired && (
                        <span className="text-[10px] text-rose-600 font-medium">Mandatory</span>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {req.reviewStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-foreground">Standard compliance checks apply</p>
                <p className="text-muted-foreground">
                  Ensure your government statutory IDs (SSS, PhilHealth, Pag-IBIG, TIN) and NBI / Police clearances are uploaded in your profile to prevent deployment delays.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Submitted Resume & Metadata Snapshot (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
            <h4 className="text-sm font-bold text-foreground border-b border-border pb-3">
              Application Snapshot
            </h4>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">Application Reference</span>
                <span className="font-mono font-bold text-foreground">APP-#{application.id}</span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Application Date</span>
                <span className="font-semibold text-foreground">{formatDate(application.createdAt)}</span>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">Last Status Update</span>
                <span className="font-semibold text-foreground">{formatDate(application.updatedAt || application.createdAt)}</span>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <span className="text-muted-foreground block mb-0.5">Attached Resume</span>
                {application.resumeUrl ? (
                  <a
                    href={application.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="download-submitted-resume"
                    className="p-3 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-between text-teal-900 hover:bg-teal-100 transition duration-150"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-700" />
                      <span className="font-semibold text-xs">Submitted Resume (PDF)</span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                  </a>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-muted-foreground">
                    Profile default resume attached
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ApplicantApplicationDetailPage as ApplicationDetailPage };
