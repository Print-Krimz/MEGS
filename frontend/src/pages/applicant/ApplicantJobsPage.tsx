import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Filter,
  X,
  Users,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { applicantApi } from '../../lib/api/applicant';
import type { JobPosting, Application } from '../../lib/types/api';

export default function ApplicantJobsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');

  const {
    data: jobsRes,
    isLoading: isJobsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applicant', 'jobs'],
    queryFn: () => applicantApi.getOpenJobs(),
  });

  const { data: appsRes } = useQuery({
    queryKey: ['applicant', 'applications'],
    queryFn: () => applicantApi.getMyApplications(),
  });

  const jobs: JobPosting[] = jobsRes?.data || [];
  const applications: Application[] = appsRes?.data || [];

  // Set of job posting IDs already applied to
  const appliedJobIds = useMemo(() => {
    return new Set(applications.map((app) => app.jobPostingId || app.jobPosting?.id));
  }, [applications]);

  // Extract unique locations for filtering
  const locations = useMemo(() => {
    const locSet = new Set<string>();
    jobs.forEach((job) => {
      if (job.location) locSet.add(job.location.trim());
    });
    return Array.from(locSet);
  }, [jobs]);

  // Filter jobs based on search term and location
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        !searchTerm.trim() ||
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.requirements?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.location?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLocation =
        locationFilter === 'ALL' ||
        job.location?.toLowerCase() === locationFilter.toLowerCase();

      return matchesSearch && matchesLocation;
    });
  }, [jobs, searchTerm, locationFilter]);

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

  if (isJobsLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Browse Open Positions"
          description="Explore career opportunities across our verified partner clients."
          breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Jobs' }]}
        />
        <ErrorState
          title="Failed to load jobs"
          message={error instanceof Error ? error.message : 'Please check your connection and try again.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="applicant-jobs-page">
      <PageHeader
        title="Explore Open Positions"
        description="Discover career opportunities tailored to your skills and qualifications. Apply directly with 1-click using your profile resume."
        breadcrumbs={[{ label: 'Dashboard', href: '/app/dashboard' }, { label: 'Jobs' }]}
      />

      {/* Search and Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col md:flex-row items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by job title, keywords, or requirements..."
            data-testid="job-search-input"
            className="w-full pl-9 pr-9 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Location Dropdown Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            data-testid="location-filter"
            className="w-full md:w-56 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="ALL">All Locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing <strong>{filteredJobs.length}</strong> available position{filteredJobs.length === 1 ? '' : 's'}
        </span>
        {(searchTerm || locationFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setLocationFilter('ALL');
            }}
            className="text-teal-700 hover:text-teal-900 font-semibold underline underline-offset-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Job Cards Grid */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          title="No job postings match your criteria"
          description={
            searchTerm || locationFilter !== 'ALL'
              ? 'Try modifying your search keywords or location filter to see more openings.'
              : 'There are currently no open positions. Please check back regularly!'
          }
          action={
            (searchTerm || locationFilter !== 'ALL') ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setLocationFilter('ALL');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition duration-150"
              >
                Reset Search Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => {
            const hasApplied = appliedJobIds.has(job.id);

            return (
              <div
                key={job.id}
                data-testid={`job-card-${job.id}`}
                className="bg-card border border-border rounded-xl p-5 shadow-subtle hover:shadow-card hover:border-teal-500/50 transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground group-hover:text-teal-700 transition duration-150 leading-snug">
                      {job.title}
                    </h3>
                    {hasApplied ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Applied
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex-shrink-0">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {job.location || 'Metro Manila'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Posted {formatDate(job.createdAt)}
                    </span>
                  </div>

                  {job.requirements && (
                    <div className="pt-1">
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {job.requirements}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between">
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {job._count?.applications !== undefined && (
                      <>
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job._count.applications} applicant{job._count.applications === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </div>

                  <Link
                    to={`/app/jobs/${job.id}`}
                    data-testid={`view-job-btn-${job.id}`}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 transition duration-150 inline-flex items-center gap-1 shadow-xs"
                  >
                    <span>{hasApplied ? 'View Status' : 'View Details'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ApplicantJobsPage as JobsPage };
