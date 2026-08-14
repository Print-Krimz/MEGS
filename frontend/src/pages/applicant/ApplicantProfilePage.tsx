import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User,
  FileText,
  Briefcase,
  GraduationCap,
  Sparkles,
  Award,
  Users,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { applicantApi } from '../../lib/api/applicant';
import { PersonalInfoSection } from './components/PersonalInfoSection';
import { ResumeSection } from './components/ResumeSection';
import { WorkExperienceSection } from './components/WorkExperienceSection';
import { EducationSection } from './components/EducationSection';
import { SkillsSection } from './components/SkillsSection';
import { TrainingsSection } from './components/TrainingsSection';
import { ReferencesSection } from './components/ReferencesSection';
import { AssetsSection } from './components/AssetsSection';
import { cn } from '../../lib/utils';

type TabId =
  | 'personal'
  | 'resume'
  | 'experience'
  | 'education'
  | 'skills'
  | 'trainings'
  | 'references'
  | 'documents';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  isComplete?: boolean;
}

export default function ApplicantProfilePage() {
  const [activeTab, setActiveTab] = useState<TabId>('personal');

  const {
    data: profileResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applicant', 'profile'],
    queryFn: () => applicantApi.getProfile(),
  });

  const profile = profileResponse?.data;

  // Evaluate section completeness
  const isPersonalComplete = Boolean(
    profile?.firstName && profile?.lastName && profile?.mobileNumber && profile?.city
  );
  const isResumeComplete = Boolean(profile?.resumeUrl && profile?.hasConsentedToAi);
  const isExpComplete = Boolean(profile?.workExperiences && profile.workExperiences.length > 0);
  const isEduComplete = Boolean(profile?.educations && profile.educations.length > 0);
  const isSkillsComplete = Boolean(profile?.skills && profile.skills.length > 0);
  const isTrainingsComplete = Boolean(profile?.trainings && profile.trainings.length > 0);
  const isRefsComplete = Boolean(profile?.characterReferences && profile.characterReferences.length > 0);
  const isDocsComplete = Boolean(profile?.assets && profile.assets.length > 0);

  const tabs: TabItem[] = [
    {
      id: 'personal',
      label: 'Personal Details',
      icon: User,
      isComplete: isPersonalComplete,
    },
    {
      id: 'resume',
      label: 'Resume & AI Consent',
      icon: FileText,
      isComplete: isResumeComplete,
    },
    {
      id: 'experience',
      label: 'Work Experience',
      icon: Briefcase,
      count: profile?.workExperiences?.length ?? 0,
      isComplete: isExpComplete,
    },
    {
      id: 'education',
      label: 'Education',
      icon: GraduationCap,
      count: profile?.educations?.length ?? 0,
      isComplete: isEduComplete,
    },
    {
      id: 'skills',
      label: 'Skills',
      icon: Sparkles,
      count: profile?.skills?.length ?? 0,
      isComplete: isSkillsComplete,
    },
    {
      id: 'trainings',
      label: 'Certifications',
      icon: Award,
      count: profile?.trainings?.length ?? 0,
      isComplete: isTrainingsComplete,
    },
    {
      id: 'references',
      label: 'References',
      icon: Users,
      count: profile?.characterReferences?.length ?? 0,
      isComplete: isRefsComplete,
    },
    {
      id: 'documents',
      label: 'Compliance Documents',
      icon: ShieldCheck,
      count: profile?.assets?.length ?? 0,
      isComplete: isDocsComplete,
    },
  ];

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Profile"
          description="Manage your professional credentials and personal information."
          breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Profile' }]}
        />
        <ErrorState
          title="Could not load profile"
          message={error instanceof Error ? error.message : 'Please try again later.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="My Profile &amp; Credentials"
        description="Maintain an updated profile to maximize job suitability and accelerate hiring endorsements."
        breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Profile' }]}
      />

      {/* Tabs Header */}
      <div className="bg-card border border-border rounded-xl p-2 shadow-subtle overflow-x-auto">
        <nav className="flex items-center space-x-1.5 min-w-max" aria-label="Profile Sections" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={cn(
                  'flex items-center gap-2 h-11 px-4 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-foreground hover:bg-slate-100'
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-500')} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={cn(
                      'h-5 min-w-[20px] px-2 flex items-center justify-center rounded-full text-xs font-mono font-bold',
                      isActive ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.isComplete && !isActive && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-0.5" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'personal' && <PersonalInfoSection profile={profile} />}
        {activeTab === 'resume' && <ResumeSection profile={profile} />}
        {activeTab === 'experience' && (
          <WorkExperienceSection experiences={profile?.workExperiences} />
        )}
        {activeTab === 'education' && <EducationSection educations={profile?.educations} />}
        {activeTab === 'skills' && <SkillsSection skills={profile?.skills} />}
        {activeTab === 'trainings' && <TrainingsSection trainings={profile?.trainings} />}
        {activeTab === 'references' && (
          <ReferencesSection references={profile?.characterReferences} />
        )}
        {activeTab === 'documents' && <AssetsSection assets={profile?.assets} />}
      </div>
    </div>
  );
}

export { ApplicantProfilePage as ProfilePage };
