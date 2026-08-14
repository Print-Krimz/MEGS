import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  MapPin,
  Users,
  Sparkles,
  Edit3,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  X,
  UserCheck,
  Phone,
  Mail,
  ExternalLink,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ScoreBadge } from '../../components/common/ScoreBadge';
import { taApi } from '../../lib/api/ta';
import { JobStatus } from '../../lib/types/enums';
import type { JobPosting, ApplicationListItem, TalentPoolMembership } from '../../lib/types/api';

export default function TAJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'ranked' | 'talent-pool' | 'details'>('ranked');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConsiderModalOpen, setIsConsiderModalOpen] = useState(false);
  const [selectedTalentMember, setSelectedTalentMember] = useState<TalentPoolMembership | null>(null);

  // Edit Form State
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    requirements: string;
    location: string;
    status: JobStatus;
  }>({
    title: '',
    description: '',
    requirements: '',
    location: '',
    status: JobStatus.OPEN,
  });

  // Queries
  const {
    data: jobRes,
    isLoading: isLoadingJob,
    isError: isJobError,
    error: jobError,
    refetch: refetchJob,
  } = useQuery({
    queryKey: ['ta', 'job', jobId],
    queryFn: () => taApi.getJob(jobId),
    enabled: !!jobId,
  });

  const {
    data: rankedRes,
    isLoading: isLoadingRanked,
    refetch: refetchRanked,
  } = useQuery({
    queryKey: ['ta', 'job', jobId, 'ranked-candidates'],
    queryFn: () => taApi.getRankedCandidates(jobId),
    enabled: !!jobId,
  });

  const {
    data: talentPoolRes,
    isLoading: isLoadingTalentPool,
    refetch: refetchTalentPool,
  } = useQuery({
    queryKey: ['ta', 'job', jobId, 'talent-pool'],
    queryFn: () => taApi.matchTalentPoolForJob(jobId),
    enabled: !!jobId,
  });

  const job: JobPosting | undefined = jobRes?.data;
  const rankedCandidates: ApplicationListItem[] = rankedRes?.data || [];
  const talentPoolMatches: TalentPoolMembership[] = talentPoolRes?.data || [];

  // Mutations
  const updateJobMutation = useMutation({
    mutationFn: async () => {
      return taApi.updateJob(jobId, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        requirements: editForm.requirements.trim(),
        location: editForm.location.trim() || undefined,
        status: editForm.status,
      });
    },
    onSuccess: () => {
      toast.success('Job posting updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'jobs'] });
      setIsEditModalOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update job';
      toast.error(msg);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (newStatus: JobStatus) => taApi.updateJobStatus(jobId, newStatus),
    onSuccess: (_, newStatus) => {
      toast.success(`Job status updated to ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['ta', 'job', jobId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'jobs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to change job status';
      toast.error(msg);
    },
  });

  const rankCandidatesMutation = useMutation({
    mutationFn: () => taApi.rankCandidates(jobId),
    onSuccess: (res) => {
      const count = res?.data?.reevaluatedCount ?? 0;
      toast.success(`AI Candidate Matching complete! (${count} evaluated)`);
      queryClient.invalidateQueries({ queryKey: ['ta', 'job', jobId, 'ranked-candidates'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to run candidate AI ranking';
      toast.error(msg);
    },
  });

  const considerCandidateMutation = useMutation({
    mutationFn: async (membershipId: number) => {
      return taApi.considerCandidate({
        membershipId,
        jobPostingId: jobId,
      });
    },
    onSuccess: () => {
      toast.success('Candidate successfully linked and considered for this job!');
      queryClient.invalidateQueries({ queryKey: ['ta', 'job', jobId, 'ranked-candidates'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'job', jobId, 'talent-pool'] });
      setIsConsiderModalOpen(false);
      setSelectedTalentMember(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to consider candidate';
      toast.error(msg);
    },
  });

  const handleOpenEdit = () => {
    if (!job) return;
    setEditForm({
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      location: job.location || '',
      status: job.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.description.trim() || !editForm.requirements.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    updateJobMutation.mutate();
  };

  if (isLoadingJob) {
    return <LoadingState variant="detail" />;
  }

  if (isJobError || !job) {
    return (
      <ErrorState
        title="Job Posting Not Found"
        message={jobError instanceof Error ? jobError.message : 'The requested job posting could not be found.'}
        onRetry={refetchJob}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back link & Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/ta/jobs"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs</span>
        </Link>
      </div>

      <PageHeader
        title={job.title}
        description={`Job Posting #${job.id} • Created on ${new Date(job.createdAt).toLocaleDateString()}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/ta/dashboard' },
          { label: 'Jobs', href: '/ta/jobs' },
          { label: job.title },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => rankCandidatesMutation.mutate()}
              disabled={rankCandidatesMutation.isPending}
              data-testid="rerank-candidates-btn"
              className="inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 active:bg-teal-200 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${rankCandidatesMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{rankCandidatesMutation.isPending ? 'Evaluating...' : 'Re-rank AI Match'}</span>
            </button>

            <button
              onClick={handleOpenEdit}
              data-testid="edit-job-btn"
              className="inline-flex items-center gap-2 h-10 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Job</span>
            </button>

            {job.status === JobStatus.OPEN ? (
              <button
                onClick={() => updateStatusMutation.mutate(JobStatus.CLOSED)}
                disabled={updateStatusMutation.isPending}
                data-testid="close-job-btn"
                className="inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 rounded-lg transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Close Job</span>
              </button>
            ) : (
              <button
                onClick={() => updateStatusMutation.mutate(JobStatus.OPEN)}
                disabled={updateStatusMutation.isPending}
                data-testid="open-job-btn"
                className="inline-flex items-center gap-1.5 h-10 px-4 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publish Open</span>
              </button>
            )}
          </div>
        }
      />

      {/* Overview Info Bar */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <span className="text-xs text-muted-foreground block font-medium">Status</span>
          <div className="mt-1.5">
            <StatusBadge status={job.status} size="md" />
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Location</span>
          <p className="text-sm font-semibold text-foreground mt-1.5 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span>{job.location || 'Remote / Unspecified'}</span>
          </p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Linked Client / MRF</span>
          {job.mrf ? (
            <Link
              to={`/ta/mrfs/${job.mrf.id}`}
              className="text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1.5 mt-1.5 truncate"
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{job.mrf.client?.name || `MRF #${job.mrf.id}`}</span>
            </Link>
          ) : (
            <p className="text-sm font-medium text-slate-500 mt-1.5">Independent Posting</p>
          )}
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Total Applicants</span>
          <p className="text-sm font-bold text-foreground mt-1.5 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-teal-600" />
            <span>{rankedCandidates.length} Candidates</span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-6">
        <button
          onClick={() => setActiveTab('ranked')}
          data-testid="tab-ranked-candidates"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'ranked'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4 text-teal-600" />
          <span>Ranked Candidates (AI Match)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-bold">
            {rankedCandidates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('talent-pool')}
          data-testid="tab-talent-pool"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'talent-pool'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <span>Talent Pool Discoveries</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
            {talentPoolMatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('details')}
          data-testid="tab-job-details"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'details'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-4 h-4 text-slate-500" />
          <span>Job Description & Requirements</span>
        </button>
      </div>

      {/* Tab 1: Ranked Candidates */}
      {activeTab === 'ranked' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Candidates Evaluated by AI Scoring Engine
              </h3>
              <p className="text-xs text-muted-foreground">
                Ranked by holistic fit score combining skills, experience, location, and credentials.
              </p>
            </div>
            <button
              onClick={() => refetchRanked()}
              className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
            >
              Refresh Ranking
            </button>
          </div>

          {isLoadingRanked ? (
            <LoadingState variant="table" />
          ) : rankedCandidates.length === 0 ? (
            <EmptyState
              title="No candidates applied yet"
              description="When applicants apply or are matched by recruiters, they will appear here ranked by their fit score."
              action={
                <button
                  onClick={() => setActiveTab('talent-pool')}
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Explore Talent Pool for Matches</span>
                </button>
              }
            />
          ) : (
            <div className="space-y-3" data-testid="ranked-candidates-list">
              {rankedCandidates.map((candidate, idx) => {
                const profile = candidate.user?.applicantProfile;
                const candidateName = profile
                  ? `${profile.firstName} ${profile.lastName}`
                  : candidate.user?.email || `Applicant #${candidate.id}`;
                const fitScore = candidate.candidateFitScore ?? candidate.aiScore ?? 0;

                return (
                  <div
                    key={candidate.id}
                    data-testid={`ranked-candidate-${candidate.id}`}
                    className="bg-card border border-border hover:border-teal-500/50 rounded-xl p-6 shadow-subtle hover:shadow-card transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Rank # & Candidate Details */}
                    <div className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300 shrink-0">
                        #{idx + 1}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <Link
                            to={`/ta/applications/${candidate.id}`}
                            className="text-base font-bold text-foreground hover:text-teal-600 transition-colors"
                          >
                            {candidateName}
                          </Link>
                          <StatusBadge status={candidate.status} size="sm" />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{candidate.user?.email}</span>
                          </span>
                          {profile?.mobileNumber && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{profile.mobileNumber}</span>
                            </span>
                          )}
                          {profile?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                {profile.city}, {profile.province}
                              </span>
                            </span>
                          )}
                        </div>

                        {candidate.aiSummary && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic mt-1">
                            "{candidate.aiSummary}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: ScoreBadge & Action Button */}
                    <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                      <div className="flex flex-col items-start md:items-end">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">
                          AI Match Score
                        </span>
                        <ScoreBadge score={fitScore} size="md" showIcon />
                      </div>

                      <Link
                        to={`/ta/applications/${candidate.id}`}
                        data-testid={`view-application-${candidate.id}`}
                        className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Workspace</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Talent Pool Discoveries */}
      {activeTab === 'talent-pool' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Matching Talent Pool Profiles
              </h3>
              <p className="text-xs text-muted-foreground">
                Candidates in the talent pool whose verified skills match this job posting's requirements.
              </p>
            </div>
            <button
              onClick={() => refetchTalentPool()}
              className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              Refresh Talent Pool
            </button>
          </div>

          {isLoadingTalentPool ? (
            <LoadingState variant="card" />
          ) : talentPoolMatches.length === 0 ? (
            <EmptyState
              title="No talent pool matches found"
              description="There are currently no indexed candidates in the talent pool matching this job's criteria."
              action={
                <Link
                  to="/ta/talent-pool"
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Browse Full Talent Pool</span>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="talent-pool-matches-grid">
              {talentPoolMatches.map((member) => {
                const profile = member.applicantProfile;
                const memberName = `${profile.firstName} ${profile.lastName}`;

                return (
                  <div
                    key={member.id}
                    data-testid={`talent-match-${member.id}`}
                    className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-foreground">{memberName}</h4>
                          <p className="text-xs text-muted-foreground">{profile.user?.email || 'Talent Pool'}</p>
                        </div>
                        <StatusBadge status={member.availability} size="sm" />
                      </div>

                      {profile.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{profile.city}, {profile.province}</span>
                        </p>
                      )}

                      {/* Skills */}
                      {profile.skills && profile.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {profile.skills.slice(0, 4).map((s, idx) => {
                            const name = typeof s === 'string' ? s : s.skill.name;
                            return (
                              <span
                                key={idx}
                                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                              >
                                {name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Added: {new Date(member.addedAt).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedTalentMember(member);
                          setIsConsiderModalOpen(true);
                        }}
                        data-testid={`consider-candidate-btn-${member.id}`}
                        className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Consider for Job</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Job Description & Qualifications */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-teal-600" />
                <span>Job Description & Responsibilities</span>
              </h3>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {job.description}
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-3">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Tag className="w-4 h-4 text-teal-600" />
                <span>Qualifications & Requirements</span>
              </h3>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {job.requirements}
              </div>
            </div>
          </div>

          {/* Sidebar Specs */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Posting Specifications
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Job Posting ID</span>
                  <span className="font-semibold text-foreground font-mono text-sm">#{job.id}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={job.status} size="sm" />
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block">Location</span>
                  <span className="font-semibold text-foreground text-sm">{job.location || 'Not Specified'}</span>
                </div>

                <div>
                  <span className="text-muted-foreground block">Date Created</span>
                  <span className="font-semibold text-foreground text-sm">
                    {new Date(job.createdAt).toLocaleString()}
                  </span>
                </div>

                {job.mrf && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-muted-foreground block">Linked Manpower Request</span>
                    <Link
                      to={`/ta/mrfs/${job.mrf.id}`}
                      className="font-semibold text-teal-600 hover:underline block mt-0.5 text-sm"
                    >
                      MRF #{job.mrf.id}: {job.mrf.title}
                    </Link>
                    <span className="text-xs text-muted-foreground mt-0.5 block">
                      Client: {job.mrf.client?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {isEditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-job-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="edit-job-modal-title" className="text-base font-semibold text-foreground">
                    Edit Job Posting
                  </h3>
                  <p className="text-xs text-muted-foreground">Update position specifications and requirements.</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="edit-job-title-input"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Location</label>
                  <input
                    type="text"
                    data-testid="edit-job-location-input"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                  <select
                    data-testid="edit-job-status-select"
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as JobStatus })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  >
                    <option value={JobStatus.OPEN}>Open</option>
                    <option value={JobStatus.DRAFT}>Draft</option>
                    <option value={JobStatus.CLOSED}>Closed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  data-testid="edit-job-description-input"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Qualifications & Requirements <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  data-testid="edit-job-requirements-input"
                  value={editForm.requirements}
                  onChange={(e) => setEditForm({ ...editForm, requirements: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-edit-job-btn"
                  disabled={updateJobMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {updateJobMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consider Candidate Modal */}
      {isConsiderModalOpen && selectedTalentMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consider-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-full">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="consider-modal-title" className="text-base font-semibold text-foreground">
                    Consider Candidate for this Job
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Link {selectedTalentMember.applicantProfile.firstName}{' '}
                    {selectedTalentMember.applicantProfile.lastName} directly to {job.title}.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg text-xs space-y-1.5">
                <div className="font-semibold text-foreground text-sm">
                  {selectedTalentMember.applicantProfile.firstName}{' '}
                  {selectedTalentMember.applicantProfile.lastName}
                </div>
                <div className="text-muted-foreground">
                  Email: {selectedTalentMember.applicantProfile.user?.email || 'N/A'}
                </div>
                <div className="text-muted-foreground">
                  Availability: {selectedTalentMember.availability}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsConsiderModalOpen(false)}
                  disabled={considerCandidateMutation.isPending}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => considerCandidateMutation.mutate(selectedTalentMember.id)}
                  disabled={considerCandidateMutation.isPending}
                  data-testid="confirm-consider-btn"
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {considerCandidateMutation.isPending ? 'Linking...' : 'Confirm Consideration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
