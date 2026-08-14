import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  User, 
  Calendar, 
  Send, 
  ShieldCheck, 
  Briefcase,
  ChevronLeft
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { CandidateSidebar } from './components/CandidateSidebar';
import { OverviewTab } from './components/OverviewTab';
import { ResumeProfileTab } from './components/ResumeProfileTab';
import { InterviewsTab } from './components/InterviewsTab';
import { EndorsementTab } from './components/EndorsementTab';
import { ComplianceTab } from './components/ComplianceTab';
import { DeploymentTab } from './components/DeploymentTab';
import { taApi } from '../../lib/api/ta';
import type { ApplicationDetail } from '../../lib/types/api';

type TabKey = 'overview' | 'resume' | 'interviews' | 'endorsement' | 'compliance' | 'deployment';

interface TabItem {
  id: TabKey;
  label: string;
  icon: typeof FileText;
  badge?: number;
}

export default function TAApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const applicationId = parseInt(id || '', 10);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Modal triggers triggered from sidebar actions
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<'INITIAL_SCREENING' | 'FINAL_INTERVIEW'>('INITIAL_SCREENING');
  const [endorseModalOpen, setEndorseModalOpen] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);

  // Fetch Application Detail
  const {
    data: applicationRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'application', applicationId],
    queryFn: () => taApi.getApplication(applicationId),
    enabled: !isNaN(applicationId),
  });

  const application: ApplicationDetail | undefined = applicationRes?.data;

  if (isNaN(applicationId)) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Candidate Recruitment Workspace"
          description="Application record not found."
          breadcrumbs={[
            { label: 'Dashboard', href: '/ta/dashboard' },
            { label: 'Applications', href: '/ta/applications' },
          ]}
        />
        <ErrorState
          title="Invalid Application ID"
          message="The requested candidate application ID is not a valid number."
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError || !application) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Candidate Recruitment Workspace"
          description="Application record could not be loaded."
          breadcrumbs={[
            { label: 'Dashboard', href: '/ta/dashboard' },
            { label: 'Applications', href: '/ta/applications' },
            { label: `Candidate #${id}` },
          ]}
        />
        <ErrorState
          title="Application Not Found"
          message={error instanceof Error ? error.message : 'The requested application record could not be found or has been removed.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const profile = application.user.applicantProfile;
  const candidateName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : application.user.email.split('@')[0];

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview & AI Score', icon: FileText },
    { id: 'resume', label: 'Resume & Profile', icon: User },
    {
      id: 'interviews',
      label: 'Interviews',
      icon: Calendar,
      badge: application.interviews?.length || 0,
    },
    {
      id: 'endorsement',
      label: 'Client Endorsement',
      icon: Send,
      badge: application.clientEndorsements?.length || 0,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: ShieldCheck,
      badge: application.complianceRequirements?.length || 0,
    },
    { id: 'deployment', label: 'Deployment & Post-Hire', icon: Briefcase },
  ];

  const handleOpenSchedule = (type: 'INITIAL_SCREENING' | 'FINAL_INTERVIEW') => {
    setScheduleType(type);
    setActiveTab('interviews');
    setScheduleModalOpen(true);
  };

  const handleOpenEndorsement = () => {
    setActiveTab('endorsement');
    setEndorseModalOpen(true);
  };

  const handleOpenDeployModal = () => {
    setActiveTab('deployment');
    setDeployModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="ta-application-detail-page">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader
          title={`${candidateName} — Recruitment Workspace`}
          description={`Comprehensive candidate dossier, AI scoring breakdown, interviews, endorsement, and compliance checklist for ${application.jobPosting.title}.`}
          breadcrumbs={[
            { label: 'Dashboard', href: '/ta/dashboard' },
            { label: 'Applications', href: '/ta/applications' },
            { label: candidateName },
          ]}
        />
        <Link
          to="/ta/applications"
          className="text-xs font-semibold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1 transition-colors self-start sm:self-auto"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Applications</span>
        </Link>
      </div>

      {/* Two-Column Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6">
        {/* Fixed Candidate Sidebar (280px / 300px) */}
        <CandidateSidebar
          application={application}
          onOpenScheduleInterview={handleOpenSchedule}
          onOpenEndorsement={handleOpenEndorsement}
          onOpenDeployModal={handleOpenDeployModal}
        />

        {/* Main Tabbed Content Area */}
        <div className="flex-1 w-full space-y-6 min-w-0">
          {/* Tab Navigation Header Bar */}
          <div className="bg-card border border-border rounded-xl p-2 shadow-subtle flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`detail-tab-${tab.id}`}
                  className={`flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg h-10 gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-foreground'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                        isActive
                          ? 'bg-teal-800 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Panes */}
          <div className="w-full">
            {activeTab === 'overview' && <OverviewTab application={application} />}
            {activeTab === 'resume' && <ResumeProfileTab application={application} />}
            {activeTab === 'interviews' && (
              <InterviewsTab
                application={application}
                isScheduleModalOpen={scheduleModalOpen}
                scheduleInitialType={scheduleType}
                onCloseScheduleModal={() => setScheduleModalOpen(false)}
              />
            )}
            {activeTab === 'endorsement' && (
              <EndorsementTab
                application={application}
                isEndorseModalOpen={endorseModalOpen}
                onCloseEndorseModal={() => setEndorseModalOpen(false)}
              />
            )}
            {activeTab === 'compliance' && <ComplianceTab application={application} />}
            {activeTab === 'deployment' && (
              <DeploymentTab
                application={application}
                isDeployModalOpen={deployModalOpen}
                onCloseDeployModal={() => setDeployModalOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export { TAApplicationDetailPage as ApplicationDetailPage };
