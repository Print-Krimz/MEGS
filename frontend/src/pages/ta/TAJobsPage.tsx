import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Plus,
  Search,
  MapPin,
  Users,
  Building2,
  Calendar,
  Eye,
  X,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { taApi } from '../../lib/api/ta';
import { JobStatus } from '../../lib/types/enums';
import type { JobPosting, ManpowerRequest } from '../../lib/types/api';

const STATUS_TABS = [
  { key: 'ALL', label: 'All Jobs' },
  { key: JobStatus.OPEN, label: 'Open' },
  { key: JobStatus.DRAFT, label: 'Draft' },
  { key: JobStatus.CLOSED, label: 'Closed' },
];

export default function TAJobsPage() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    requirements: string;
    location: string;
    mrfId: string;
    status: JobStatus;
  }>({
    title: '',
    description: '',
    requirements: '',
    location: '',
    mrfId: '',
    status: JobStatus.OPEN,
  });

  // Queries
  const {
    data: jobsRes,
    isLoading: isLoadingJobs,
    isError: isJobsError,
    error: jobsError,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ['ta', 'jobs'],
    queryFn: () => taApi.listJobs(),
  });

  const { data: mrfsRes } = useQuery({
    queryKey: ['ta', 'mrfs'],
    queryFn: () => taApi.listMRFs(),
  });

  const jobs: JobPosting[] = jobsRes?.data || [];
  const mrfs: ManpowerRequest[] = mrfsRes?.data || [];

  // Create Job Mutation
  const createJobMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        requirements: formData.requirements.trim(),
        location: formData.location.trim() || undefined,
        status: formData.status,
        mrfId: formData.mrfId ? parseInt(formData.mrfId, 10) : undefined,
      };
      return taApi.createJob(payload);
    },
    onSuccess: () => {
      toast.success('Job posting created successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'jobs'] });
      setIsCreateModalOpen(false);
      setFormData({
        title: '',
        description: '',
        requirements: '',
        location: '',
        mrfId: '',
        status: JobStatus.OPEN,
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create job posting';
      toast.error(msg);
    },
  });

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesTab = selectedTab === 'ALL' || job.status === selectedTab;
      if (!matchesTab) return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const matchesTitle = job.title.toLowerCase().includes(query);
      const matchesLocation = job.location?.toLowerCase().includes(query) || false;
      const matchesClient = job.mrf?.client?.name.toLowerCase().includes(query) || false;
      const matchesMrf = job.mrf?.title.toLowerCase().includes(query) || false;

      return matchesTitle || matchesLocation || matchesClient || matchesMrf;
    });
  }, [jobs, selectedTab, searchQuery]);

  // Summary counts
  const counts = useMemo(() => {
    return {
      all: jobs.length,
      open: jobs.filter((j) => j.status === JobStatus.OPEN).length,
      draft: jobs.filter((j) => j.status === JobStatus.DRAFT).length,
      closed: jobs.filter((j) => j.status === JobStatus.CLOSED).length,
    };
  }, [jobs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim() || !formData.requirements.trim()) {
      toast.error('Please fill in all required fields (Title, Description, Requirements)');
      return;
    }
    createJobMutation.mutate();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Job Postings Management"
        description="Create, update, and manage job descriptions, requirements, linked MRFs, and applicant matching."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Jobs' }]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="create-job-btn"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Job Posting</span>
          </button>
        }
      />

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Postings</span>
            <Briefcase className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{counts.all}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Open</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{counts.open}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Draft Postings</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{counts.draft}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closed</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">{counts.closed}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.key === 'ALL'
                  ? counts.all
                  : tab.key === JobStatus.OPEN
                  ? counts.open
                  : tab.key === JobStatus.DRAFT
                  ? counts.draft
                  : counts.closed;
              const isActive = selectedTab === tab.key;
              return (
                <button
                  key={tab.key}
                  data-testid={`tab-${tab.key.toLowerCase()}`}
                  onClick={() => setSelectedTab(tab.key)}
                  className={`h-9 px-4 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              data-testid="job-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, location, client..."
              className="w-full h-10 px-3.5 pl-10 text-sm bg-background border border-slate-300 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoadingJobs ? (
        <LoadingState variant="page" />
      ) : isJobsError ? (
        <ErrorState
          title="Failed to load job postings"
          message={jobsError instanceof Error ? jobsError.message : 'An error occurred while fetching jobs.'}
          onRetry={refetchJobs}
        />
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          title={searchQuery || selectedTab !== 'ALL' ? 'No matching job postings found' : 'No job postings yet'}
          description={
            searchQuery || selectedTab !== 'ALL'
              ? 'Try modifying your search criteria or switching status tabs.'
              : 'Create your first job posting to start attracting and matching candidates.'
          }
          action={
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Job Posting</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="jobs-grid">
          {filteredJobs.map((job) => {
            const applicantsCount = job._count?.applications ?? 0;
            const hasMrf = !!job.mrf;
            const clientName = job.mrf?.client?.name;

            return (
              <div
                key={job.id}
                data-testid={`job-card-${job.id}`}
                className="bg-card border border-border hover:border-teal-500/50 rounded-xl p-6 shadow-subtle hover:shadow-card transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-3.5">
                  {/* Card Header: Status & Tags */}
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={job.status} size="sm" />
                    {hasMrf && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>MRF #{job.mrfId}</span>
                      </span>
                    )}
                  </div>

                  {/* Job Title */}
                  <div>
                    <Link
                      to={`/ta/jobs/${job.id}`}
                      className="text-base font-semibold text-foreground group-hover:text-teal-600 transition-colors line-clamp-2"
                    >
                      {job.title}
                    </Link>
                    {clientName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700 dark:text-slate-300">{clientName}</span>
                      </p>
                    )}
                  </div>

                  {/* Location and Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {job.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Salary Tag */}
                  <div className="pt-1">
                    <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200/60 rounded-full dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                      Standard Market Compensation
                    </span>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>
                </div>

                {/* Footer Strip */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <Users className="w-4 h-4 text-teal-600" />
                    <span>{applicantsCount} {applicantsCount === 1 ? 'Applicant' : 'Applicants'}</span>
                  </div>

                  <Link
                    to={`/ta/jobs/${job.id}`}
                    data-testid={`view-job-${job.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-lg bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Details</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Job Posting Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-job-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="create-job-modal-title" className="text-base font-semibold text-foreground">
                    Create New Job Posting
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define the position details, qualifications, and optional MRF link.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="job-title-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Warehouse Operations Specialist"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Location & Status in Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Location
                  </label>
                  <input
                    type="text"
                    data-testid="job-location-input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Taguig City, Metro Manila"
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Initial Status
                  </label>
                  <select
                    data-testid="job-status-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as JobStatus })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  >
                    <option value={JobStatus.OPEN}>Open (Published)</option>
                    <option value={JobStatus.DRAFT}>Draft</option>
                  </select>
                </div>
              </div>

              {/* Link to Manpower Request (MRF) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Link to Manpower Request (MRF) <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <select
                  data-testid="job-mrf-select"
                  value={formData.mrfId}
                  onChange={(e) => setFormData({ ...formData, mrfId: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                >
                  <option value="">None (Independent Job Posting)</option>
                  {mrfs.map((mrf) => (
                    <option key={mrf.id} value={mrf.id}>
                      MRF #{mrf.id}: {mrf.title} ({mrf.client?.name || 'Client'}) - {mrf.headcount} slots
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  data-testid="job-description-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide an overview of the role, daily responsibilities, and team expectations..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Qualifications & Requirements <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  data-testid="job-requirements-input"
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="List required skills, education, certifications, and years of experience..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={createJobMutation.isPending}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-job-btn"
                  disabled={createJobMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {createJobMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create Job</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
