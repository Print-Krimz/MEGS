import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  Briefcase,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PipelineIndicator } from '../../components/common/PipelineIndicator';
import { applicantApi } from '../../lib/api/applicant';
import { ApplicationStatus } from '../../lib/types/enums';
import type { Application } from '../../lib/types/api';

type FilterTab = 'ALL' | 'ACTIVE' | 'HIRED' | 'ARCHIVED';

export default function ApplicantApplicationsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredApplications = useMemo(() => {
    const activeStatuses: ApplicationStatus[] = [
      ApplicationStatus.HIRED,
      ApplicationStatus.DEPLOYED,
      ApplicationStatus.ARCHIVED,
      ApplicationStatus.BACKOUT,
    ];

    const hiredStatuses: ApplicationStatus[] = [
      ApplicationStatus.HIRED,
      ApplicationStatus.ONBOARDING,
      ApplicationStatus.COMPLIANCE,
      ApplicationStatus.DEPLOYED,
    ];

    const archivedStatuses: ApplicationStatus[] = [
      ApplicationStatus.ARCHIVED,
      ApplicationStatus.BACKOUT,
      ApplicationStatus.TALENT_POOL,
    ];

    return applications.filter((app) => {
      // Search matching
      const matchesSearch =
        !searchQuery.trim() ||
        app.jobPosting?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobPosting?.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.status.toLowerCase().includes(searchQuery.toLowerCase());

      // Status tab matching
      let matchesTab = true;
      if (activeTab === 'ACTIVE') {
        matchesTab = !activeStatuses.includes(app.status);
      } else if (activeTab === 'HIRED') {
        matchesTab = hiredStatuses.includes(app.status);
      } else if (activeTab === 'ARCHIVED') {
        matchesTab = archivedStatuses.includes(app.status);
      }

      return matchesSearch && matchesTab;
    });
  }, [applications, searchQuery, activeTab]);

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

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Applications"
          description="Track the status and progress of all your submitted job applications."
          breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Applications' }]}
        />
        <ErrorState
          title="Failed to load applications"
          message={error instanceof Error ? error.message : 'Please check your connection and retry.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="applicant-applications-page">
      <PageHeader
        title="My Job Applications"
        description="Monitor real-time progress across screening, client endorsement, interviews, and pre-employment onboarding."
        breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Applications' }]}
      />

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
          {(
            [
              { id: 'ALL', label: `All (${applications.length})` },
              { id: 'ACTIVE', label: 'Active Pipeline' },
              { id: 'HIRED', label: 'Hired / Placed' },
              { id: 'ARCHIVED', label: 'Archived' },
            ] as { id: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition duration-150 ${
                activeTab === tab.id
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-slate-600 hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applications..."
            data-testid="applications-search-input"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>
      </div>

      {/* Applications List */}
      {filteredApplications.length === 0 ? (
        <EmptyState
          title={applications.length === 0 ? 'No job applications yet' : 'No matching applications found'}
          description={
            applications.length === 0
              ? 'You have not submitted any applications. Browse our active vacancies and apply with your profile credentials.'
              : 'Try changing your status tab or clearing the search query.'
          }
          action={
            applications.length === 0 ? (
              <Link
                to="/app/jobs"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 shadow-xs inline-flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Browse Available Jobs</span>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4" data-testid="applications-list">
          {filteredApplications.map((app) => (
            <div
              key={app.id}
              data-testid={`application-card-${app.id}`}
              className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-subtle hover:shadow-card hover:border-teal-500/40 transition duration-150 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-800">
                      APP-#{app.id}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Applied {formatDate(app.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground">
                    {app.jobPosting?.title || 'Job Application'}
                  </h3>
                  {app.jobPosting?.location && (
                    <div className="text-xs text-slate-600 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{app.jobPosting.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge status={app.status} />
                  <Link
                    to={`/app/applications/${app.id}`}
                    data-testid={`view-application-link-${app.id}`}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1 shadow-xs"
                  >
                    <span>View Stage</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Condensed Pipeline tracker */}
              <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground font-medium inline-flex items-center gap-1">
                  <Layers className="w-3 h-3 text-teal-700" />
                  Stage Progress:
                </span>
                <PipelineIndicator currentStatus={app.status} variant="condensed" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { ApplicantApplicationsPage as ApplicationsPage };
