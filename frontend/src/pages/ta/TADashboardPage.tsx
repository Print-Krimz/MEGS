import { useQuery } from '@tanstack/react-query';
import { Users, Briefcase, CalendarCheck, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { PipelineSummaryBar } from './components/PipelineSummaryBar';
import { ActionRequiredSection } from './components/ActionRequiredSection';
import { MRFTrackerCard } from './components/MRFTrackerCard';
import { ApplicationTable } from './components/ApplicationTable';
import { taApi } from '../../lib/api/ta';
import { ApplicationStatus } from '../../lib/types/enums';
import type { ApplicationListItem } from '../../lib/types/api';

export default function TADashboardPage() {
  // 1. Pipeline Stats Query
  const {
    data: pipelineStatsRes,
    isLoading: isLoadingPipeline,
    isError: isErrorPipeline,
    error: errorPipeline,
    refetch: refetchPipeline,
  } = useQuery({
    queryKey: ['ta', 'pipeline-stats'],
    queryFn: () => taApi.getPipelineStats(),
  });

  // 2. Recent Applications Query
  const {
    data: applicationsRes,
    isLoading: isLoadingApps,
    isError: isErrorApps,
    error: errorApps,
    refetch: refetchApps,
  } = useQuery({
    queryKey: ['ta', 'applications', 'recent'],
    queryFn: () => taApi.listApplications({ limit: 10 }),
  });

  // 3. MRFs Query
  const {
    data: mrfsRes,
    isLoading: isLoadingMrfs,
    isError: isErrorMrfs,
    error: errorMrfs,
    refetch: refetchMrfs,
  } = useQuery({
    queryKey: ['ta', 'mrfs'],
    queryFn: () => taApi.listMRFs(),
  });

  // 4. Interview Compliance & SLA Query
  const {
    data: interviewComplianceRes,
    isLoading: isLoadingCompliance,
    refetch: refetchCompliance,
  } = useQuery({
    queryKey: ['ta', 'compliance', 'interviews'],
    queryFn: () => taApi.checkInterviewCompliance(),
  });

  // 5. Compliance Overview Query
  const {
    data: complianceOverviewRes,
    isLoading: isLoadingCompOverview,
    refetch: refetchCompOverview,
  } = useQuery({
    queryKey: ['ta', 'compliance', 'overview'],
    queryFn: () => taApi.getComplianceOverview(),
  });

  const pipelineStats = pipelineStatsRes?.data;
  const applications: ApplicationListItem[] = applicationsRes?.data || [];
  const mrfs = mrfsRes?.data || [];
  const interviewCompliance = interviewComplianceRes?.data;
  const complianceOverview = complianceOverviewRes?.data;

  const isAnyLoading = isLoadingPipeline || isLoadingApps || isLoadingMrfs;
  const isAnyError = isErrorPipeline || isErrorApps || isErrorMrfs;

  const handleRetryAll = () => {
    refetchPipeline();
    refetchApps();
    refetchMrfs();
    refetchCompliance();
    refetchCompOverview();
  };

  if (isAnyLoading) {
    return <LoadingState variant="page" />;
  }

  if (isAnyError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Talent Acquisition Command Center"
          description="Monitor active candidate pipelines, interview schedules, and urgent compliance items."
        />
        <ErrorState
          title="Failed to load dashboard metrics"
          message={
            (errorPipeline instanceof Error && errorPipeline.message) ||
            (errorApps instanceof Error && errorApps.message) ||
            (errorMrfs instanceof Error && errorMrfs.message) ||
            'Unable to communicate with the recruitment backend service.'
          }
          onRetry={handleRetryAll}
        />
      </div>
    );
  }

  // Derive alert statistics
  const needsAttentionApps = applications.filter(
    (app) => app.status === ApplicationStatus.NEEDS_ATTENTION
  );
  const pendingSlaCount = interviewCompliance?.pendingSla ?? 0;
  const unreviewedDocsCount = complianceOverview?.pendingReviewCount ?? 0;

  // Derive quick summary stats
  const totalActive = pipelineStats?.totalActive ?? applications.length;
  const openMrfsCount = mrfs.filter((m) => m.status === 'OPEN').length;
  const pendingInterviewsCount =
    (pipelineStats?.byStatus?.[ApplicationStatus.INITIAL_SCREENING] ?? 0) +
    (pipelineStats?.byStatus?.[ApplicationStatus.FINAL_INTERVIEW] ?? 0);
  const compliancePendingCount =
    pipelineStats?.byStatus?.[ApplicationStatus.COMPLIANCE] ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="ta-dashboard-page">
      <PageHeader
        title="Talent Acquisition Command Center"
        description="Real-time candidate pipeline orchestration, SLA audit enforcement, and recruitment operational intelligence."
      />

      {/* Top High-level Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-metric-cards">
        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3.5 bg-teal-50 text-teal-700 rounded-xl shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Active Pipeline</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-0.5" data-testid="stat-active-candidates">
              {totalActive}
            </div>
            <div className="text-xs text-teal-800 font-medium mt-1">
              Across {Object.keys(pipelineStats?.byStatus || {}).length || 8} stages
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-700 rounded-xl shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Open MRFs</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-0.5" data-testid="stat-open-mrfs">
              {openMrfsCount}
            </div>
            <div className="text-xs text-blue-800 font-medium mt-1">
              Active client requests
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Interviews Active</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-0.5" data-testid="stat-active-interviews">
              {pendingInterviewsCount}
            </div>
            <div className="text-xs text-amber-800 font-medium mt-1">
              {pendingSlaCount > 0 ? `${pendingSlaCount} SLA alerts` : 'SLA compliant'}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3.5 bg-orange-50 text-orange-700 rounded-xl shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Compliance Stage</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-0.5" data-testid="stat-compliance-stage">
              {compliancePendingCount}
            </div>
            <div className="text-xs text-orange-800 font-medium mt-1">
              {unreviewedDocsCount > 0 ? `${unreviewedDocsCount} unreviewed docs` : 'Ready to deploy'}
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      <PipelineSummaryBar stats={pipelineStats} isLoading={isLoadingPipeline} />

      {/* Action Required Bottleneck Section */}
      <ActionRequiredSection
        needsAttentionApplications={needsAttentionApps}
        pendingSlaInterviewsCount={pendingSlaCount}
        unreviewedDocsCount={unreviewedDocsCount}
        isLoading={isLoadingCompliance || isLoadingCompOverview}
      />

      {/* MRF Quota & Fulfillment Tracker */}
      <MRFTrackerCard mrfs={mrfs} isLoading={isLoadingMrfs} />

      {/* Recent Applications Section */}
      <div className="space-y-3" data-testid="recent-applications-section">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">
              Recent Application Stream
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Latest candidate submissions, scores, and active stage milestones.
            </p>
          </div>
          <Link
            to="/ta/applications"
            className="text-sm font-semibold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>View All Applications</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <ApplicationTable
          applications={applications.slice(0, 10)}
          isLoading={isLoadingApps}
          emptyTitle="No applications received yet"
          emptyDescription="As candidates apply for active job postings, their dossiers will stream here."
        />
      </div>
    </div>
  );
}

export { TADashboardPage as DashboardPage };
