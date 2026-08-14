import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  FileText,
  User,
  ArrowRight,
  Sparkles,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { applicantApi } from '../../lib/api/applicant';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ApplicationStatus } from '../../lib/types/enums';
import { cn } from '../../lib/utils';
import type { Application, JobPosting } from '../../lib/types/api';

interface CompletenessItem {
  key: string;
  label: string;
  weight: number;
  isComplete: boolean;
  tabHref: string;
}

export default function ApplicantDashboardPage() {
  const { user } = useAuth();

  const { data: profileRes, isLoading: isProfileLoading } = useQuery({
    queryKey: ['applicant', 'profile'],
    queryFn: () => applicantApi.getProfile(),
  });

  const { data: applicationsRes, isLoading: isAppsLoading } = useQuery({
    queryKey: ['applicant', 'applications'],
    queryFn: () => applicantApi.getMyApplications(),
  });

  const { data: jobsRes, isLoading: isJobsLoading } = useQuery({
    queryKey: ['applicant', 'jobs'],
    queryFn: () => applicantApi.getOpenJobs(),
  });

  const profile = profileRes?.data;
  const applications: Application[] = applicationsRes?.data || [];
  const jobs: JobPosting[] = jobsRes?.data || [];

  const displayName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName}`
    : user?.email?.split('@')[0] || 'Applicant';

  // Calculate profile completeness breakdown
  const completenessItems: CompletenessItem[] = [
    {
      key: 'personal',
      label: 'Personal Information',
      weight: 25,
      isComplete: Boolean(
        profile?.firstName && profile?.lastName && profile?.mobileNumber && profile?.city && profile?.address
      ),
      tabHref: '/app/profile',
    },
    {
      key: 'resume',
      label: 'PDF Resume Attached',
      weight: 25,
      isComplete: Boolean(profile?.resumeUrl),
      tabHref: '/app/profile',
    },
    {
      key: 'aiConsent',
      label: 'AI Matching Consent',
      weight: 10,
      isComplete: Boolean(profile?.hasConsentedToAi),
      tabHref: '/app/profile',
    },
    {
      key: 'experience',
      label: 'Work Experience',
      weight: 15,
      isComplete: Boolean(profile?.workExperiences && profile.workExperiences.length > 0),
      tabHref: '/app/profile',
    },
    {
      key: 'education',
      label: 'Education History',
      weight: 15,
      isComplete: Boolean(profile?.educations && profile.educations.length > 0),
      tabHref: '/app/profile',
    },
    {
      key: 'skills',
      label: 'Skills & Competencies',
      weight: 10,
      isComplete: Boolean(profile?.skills && profile.skills.length > 0),
      tabHref: '/app/profile',
    },
  ];

  const totalPercentage = completenessItems.reduce((acc, item) => {
    return acc + (item.isComplete ? item.weight : 0);
  }, 0);

  const missingItems = completenessItems.filter((item) => !item.isComplete);

  // Application Counters
  const activeStatuses: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.PARSING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.MATCHED,
    ApplicationStatus.INITIAL_SCREENING,
    ApplicationStatus.CLIENT_ENDORSEMENT,
    ApplicationStatus.FINAL_INTERVIEW,
    ApplicationStatus.ONBOARDING,
    ApplicationStatus.COMPLIANCE,
  ];

  const activeApplicationsCount = applications.filter((app) =>
    activeStatuses.includes(app.status)
  ).length;

  const inReviewStatuses: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.PARSING,
    ApplicationStatus.REVIEW,
    ApplicationStatus.MATCHED,
  ];
  const inReviewCount = applications.filter((app) =>
    inReviewStatuses.includes(app.status)
  ).length;

  const interviewStatuses: ApplicationStatus[] = [
    ApplicationStatus.INITIAL_SCREENING,
    ApplicationStatus.FINAL_INTERVIEW,
    ApplicationStatus.CLIENT_ENDORSEMENT,
  ];
  const interviewCount = applications.filter((app) =>
    interviewStatuses.includes(app.status)
  ).length;

  const hiredStatuses: ApplicationStatus[] = [
    ApplicationStatus.HIRED,
    ApplicationStatus.ONBOARDING,
    ApplicationStatus.COMPLIANCE,
    ApplicationStatus.DEPLOYED,
  ];
  const hiredCount = applications.filter((app) =>
    hiredStatuses.includes(app.status)
  ).length;

  const recentApplications = applications.slice(0, 4);
  const featuredJobs = jobs.slice(0, 3);

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

  if (isProfileLoading && isAppsLoading && isJobsLoading) {
    return <LoadingState variant="page" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200" data-testid="applicant-dashboard">
      {/* 1. Welcome & Quick Action Banner */}
      <div className="bg-linear-to-r from-teal-800 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-card relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-xs text-teal-200 border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              Candidate Recruitment Portal
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/80 leading-relaxed">
              Track your recruitment stage progress in real time, keep your credentials current, and discover new openings matched to your profile.
            </p>
          </div>

          {/* Quick Actions Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/app/jobs"
              data-testid="quick-action-jobs"
              className="px-4 py-2.5 rounded-xl bg-white text-teal-900 hover:bg-teal-50 font-semibold text-xs transition duration-150 inline-flex items-center gap-2 shadow-sm"
            >
              <Briefcase className="w-4 h-4 text-teal-700" />
              <span>Browse Open Jobs</span>
            </Link>
            <Link
              to="/app/profile"
              data-testid="quick-action-profile"
              className="px-4 py-2.5 rounded-xl bg-teal-700/80 hover:bg-teal-700 text-white font-semibold text-xs border border-white/20 transition duration-150 inline-flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Complete Profile</span>
            </Link>
            <Link
              to="/app/applications"
              data-testid="quick-action-applications"
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/10 transition duration-150 inline-flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Track Applications</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Profile Completion Widget */}
      <div
        className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4"
        data-testid="profile-completion-widget"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-700" />
            <h3 className="text-sm font-bold text-foreground">Profile Completeness</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-extrabold text-foreground">
              {totalPercentage}%
            </span>
            <span className="text-xs text-muted-foreground">
              {totalPercentage === 100 ? 'Fully Completed' : 'Completed'}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
          <div
            data-testid="profile-progress-bar"
            className={cn(
              'h-2.5 rounded-full transition-all duration-500',
              totalPercentage === 100
                ? 'bg-emerald-600'
                : totalPercentage >= 60
                ? 'bg-teal-600'
                : 'bg-amber-500'
            )}
            style={{ width: `${totalPercentage}%` }}
          />
        </div>

        {/* Breakdown of sections */}
        {missingItems.length > 0 ? (
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Missing sections to complete your profile:
              </span>
              <Link
                to="/app/profile"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
              >
                <span>Complete now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {missingItems.map((item) => (
                <Link
                  key={item.key}
                  to={item.tabHref}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition duration-150 inline-flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Your profile is 100% complete! Your chances of matching top employer requisitions are maximized.
            </span>
          </div>
        )}
      </div>

      {/* 3. Application Pipeline Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="application-stats">
        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Active Submissions</span>
            <FileText className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {activeApplicationsCount}
          </div>
          <p className="text-[11px] text-muted-foreground">Currently in hiring pipeline</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Review / Screening</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {inReviewCount}
          </div>
          <p className="text-[11px] text-muted-foreground">Initial assessment stages</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Interviews &amp; Client</span>
            <User className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {interviewCount}
          </div>
          <p className="text-[11px] text-muted-foreground">Interviews &amp; endorsements</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Hired / Deployed</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-foreground">
            {hiredCount}
          </div>
          <p className="text-[11px] text-muted-foreground">Accepted and placed</p>
        </div>
      </div>

      {/* 4. Recent Applications & Featured Jobs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Applications (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-700" />
              <h3 className="text-sm font-bold text-foreground">Recent Applications</h3>
            </div>
            {applications.length > 0 && (
              <Link
                to="/app/applications"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
              >
                <span>View All ({applications.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {applications.length === 0 ? (
            <EmptyState
              title="No applications submitted yet"
              description="Start your job search today by exploring our latest open job requisitions."
              action={
                <Link
                  to="/app/jobs"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 shadow-xs inline-flex items-center gap-1.5"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Browse Open Jobs</span>
                </Link>
              }
            />
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-subtle divide-y divide-border">
              {recentApplications.map((app) => (
                <div
                  key={app.id}
                  data-testid={`dashboard-app-item-${app.id}`}
                  className="p-4 hover:bg-slate-50/70 transition duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <Link
                      to={`/app/applications/${app.id}`}
                      className="text-sm font-bold text-foreground hover:text-teal-700 transition duration-150"
                    >
                      {app.jobPosting?.title || `Application #${app.id}`}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {app.jobPosting?.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {app.jobPosting.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Applied {formatDate(app.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <StatusBadge status={app.status} />
                    <Link
                      to={`/app/applications/${app.id}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 transition duration-150"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Featured Open Jobs (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-teal-700" />
              <h3 className="text-sm font-bold text-foreground">Available Open Positions</h3>
            </div>
            {jobs.length > 0 && (
              <Link
                to="/app/jobs"
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
              >
                <span>See All ({jobs.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="p-8 text-center bg-card border border-border rounded-xl shadow-subtle space-y-2">
              <p className="text-xs font-semibold text-foreground">No open positions at this moment</p>
              <p className="text-xs text-muted-foreground">
                Please check back soon or keep your profile updated for direct headhunting.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {featuredJobs.map((job) => (
                <div
                  key={job.id}
                  data-testid={`dashboard-job-card-${job.id}`}
                  className="p-4 bg-card border border-border rounded-xl shadow-subtle hover:shadow-card hover:border-teal-500/50 transition duration-150 space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-foreground group-hover:text-teal-700 transition duration-150">
                      {job.title}
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
                      Open
                    </span>
                  </div>

                  {job.requirements && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {job.requirements}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs border-t border-border">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {job.location || 'Metro Manila'}
                    </span>
                    <Link
                      to={`/app/jobs/${job.id}`}
                      className="font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                    >
                      <span>View &amp; Apply</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ApplicantDashboardPage as DashboardPage };
