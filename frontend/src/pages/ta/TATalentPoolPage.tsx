import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  Sparkles,
  UserCheck,
  MapPin,
  Mail,
  Phone,
  MessageSquare,
  X,
  Clock,
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
import { JobStatus, CandidateAvailability } from '../../lib/types/enums';
import type {
  TalentPoolSearchResult,
  TalentPoolMembership,
  JobPosting,
} from '../../lib/types/api';

const AVAILABILITY_FILTERS = [
  { key: 'ALL', label: 'All Candidates' },
  { key: CandidateAvailability.AVAILABLE, label: 'Available' },
  { key: CandidateAvailability.UNAVAILABLE, label: 'Employed / Unavailable' },
  { key: CandidateAvailability.UNKNOWN, label: 'Not Looking / Unknown' },
];

function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName ? firstName.charAt(0).toUpperCase() : '';
  const last = lastName ? lastName.charAt(0).toUpperCase() : '';
  return first + last || 'C';
}

export default function TATalentPoolPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('ALL');

  // Modals
  const [selectedCandidate, setSelectedCandidate] = useState<TalentPoolMembership | null>(null);
  const [isConsiderModalOpen, setIsConsiderModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Consider Form State
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  // Contact Log Form State
  const [contactForm, setContactForm] = useState<{
    jobPostingId: string;
    outcome: string;
    notes: string;
  }>({
    jobPostingId: '',
    outcome: 'INTERESTED',
    notes: '',
  });

  // Queries
  const {
    data: searchRes,
    isLoading: isLoadingCandidates,
    isError: isSearchError,
    error: searchError,
    refetch: refetchCandidates,
    isFetching: isFetchingCandidates,
  } = useQuery({
    queryKey: ['ta', 'talent-pool', 'search', activeQuery, availabilityFilter],
    queryFn: () =>
      taApi.searchTalentPool({
        query: activeQuery,
        availability: availabilityFilter !== 'ALL' ? availabilityFilter : undefined,
      }),
  });

  const { data: jobsRes } = useQuery({
    queryKey: ['ta', 'jobs', 'open'],
    queryFn: () => taApi.listJobs({ status: JobStatus.OPEN }),
  });

  const searchResults: TalentPoolSearchResult[] = searchRes?.data || [];
  const openJobs: JobPosting[] = jobsRes?.data || [];

  // Mutations
  const considerMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCandidate || !selectedJobId) {
        throw new Error('Candidate and Job posting must be selected');
      }
      return taApi.considerCandidate({
        membershipId: selectedCandidate.id,
        jobPostingId: parseInt(selectedJobId, 10),
      });
    },
    onSuccess: () => {
      toast.success('Candidate successfully linked and application initiated!');
      queryClient.invalidateQueries({ queryKey: ['ta', 'talent-pool'] });
      setIsConsiderModalOpen(false);
      setSelectedCandidate(null);
      setSelectedJobId('');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to consider candidate';
      toast.error(msg);
    },
  });

  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCandidate || !contactForm.jobPostingId) {
        throw new Error('Candidate and Job posting are required');
      }
      return taApi.contactTalentPoolMember({
        membershipId: selectedCandidate.id,
        jobPostingId: parseInt(contactForm.jobPostingId, 10),
        outcome: contactForm.outcome,
        notes: contactForm.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Contact interaction logged successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'talent-pool'] });
      setIsContactModalOpen(false);
      setSelectedCandidate(null);
      setContactForm({ jobPostingId: '', outcome: 'INTERESTED', notes: '' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to log contact note';
      toast.error(msg);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Talent Pool & Semantic Candidate Search"
        description="Discover pre-screened talent, search by semantic skills matching, and immediately consider qualified members for active requisitions."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Talent Pool' }]}
      />

      {/* Semantic AI Search Bar Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-600" />
            <input
              type="text"
              data-testid="talent-pool-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search semantically (e.g. 'Forklift operator with NCII', 'React TypeScript frontend', 'Bilingual CSR')..."
              className="w-full h-11 pl-10 pr-10 text-sm bg-background border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            data-testid="search-talent-btn"
            className="inline-flex items-center justify-center gap-2 h-11 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Search Talent Pool</span>
          </button>
        </form>

        {/* Availability Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Availability:</span>
          {AVAILABILITY_FILTERS.map((filter) => {
            const isActive = availabilityFilter === filter.key;
            return (
              <button
                key={filter.key}
                data-testid={`filter-avail-${filter.key.toLowerCase()}`}
                onClick={() => setAvailabilityFilter(filter.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full min-h-[32px] inline-flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs border border-teal-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-teal-600" />
          <span>{searchResults.length} Indexed Candidates in Talent Pool</span>
          {activeQuery && (
            <span className="text-xs text-muted-foreground font-normal">
              matching "{activeQuery}"
            </span>
          )}
        </div>

        <button
          onClick={() => refetchCandidates()}
          className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 inline-flex items-center gap-1.5 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingCandidates ? 'animate-spin text-teal-600' : 'text-slate-500'}`} />
          <span>Refresh Results</span>
        </button>
      </div>

      {/* Main Content */}
      {isLoadingCandidates ? (
        <LoadingState variant="page" />
      ) : isSearchError ? (
        <ErrorState
          title="Failed to search talent pool"
          message={searchError instanceof Error ? searchError.message : 'An error occurred.'}
          onRetry={refetchCandidates}
        />
      ) : searchResults.length === 0 ? (
        <EmptyState
          title="No talent pool candidates found"
          description={
            activeQuery || availabilityFilter !== 'ALL'
              ? 'Try relaxing your search terms or checking different availability filters.'
              : 'Add candidates to the talent pool from applications or bulk imports.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="talent-pool-grid">
          {searchResults.map((result) => {
            const member = result.membership;
            const profile = member.applicantProfile;
            const candidateName = profile
              ? `${profile.firstName} ${profile.lastName}`
              : `Candidate #${member.id}`;
            const similarity = result.similarityScore;
            const matchedSkills = result.matchedSkills || [];

            return (
              <div
                key={member.id}
                data-testid={`talent-card-${member.id}`}
                className="p-6 rounded-xl border border-border bg-card shadow-subtle flex flex-col justify-between hover:border-teal-500/50 hover:shadow-card transition-all duration-200 group"
              >
                <div className="space-y-4">
                  {/* Card Top: Availability & Match Score */}
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={member.availability} size="sm" />
                    {similarity !== undefined && similarity !== null && (
                      <ScoreBadge score={similarity} size="md" showIcon />
                    )}
                  </div>

                  {/* Candidate Info with Avatar */}
                  <div className="flex items-start gap-3.5 pt-1">
                    <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-bold text-base flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-700 shadow-xs">
                      {getInitials(profile?.firstName, profile?.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground group-hover:text-teal-600 transition-colors truncate">
                        {candidateName}
                      </h3>
                      {profile?.professionalSummary && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {profile.professionalSummary}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground space-y-1 mt-2">
                        {profile?.user?.email && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{profile.user.email}</span>
                          </p>
                        )}
                        {profile?.mobileNumber && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{profile.mobileNumber}</span>
                          </p>
                        )}
                        {profile?.city && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>
                              {profile.city}{profile.province ? `, ${profile.province}` : ''}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Matched Skills Highlights */}
                  {matchedSkills.length > 0 && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Matched Skills:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedSkills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* General Profile Skills */}
                  {profile?.skills && profile.skills.length > 0 && matchedSkills.length === 0 && (
                    <div className="pt-3 border-t border-border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                        Skills:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.slice(0, 4).map((s, idx) => {
                          const name = typeof s === 'string' ? s : s.skill?.name || 'Skill';
                          return (
                            <span
                              key={idx}
                              className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700"
                            >
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Last Contact Date */}
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {member.lastContactedAt
                        ? `Last Contacted: ${new Date(member.lastContactedAt).toLocaleDateString()}`
                        : `Added: ${new Date(member.addedAt).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setSelectedCandidate(member);
                      setIsContactModalOpen(true);
                    }}
                    data-testid={`log-contact-btn-${member.id}`}
                    className="h-9 px-4 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Log Contact</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCandidate(member);
                      setIsConsiderModalOpen(true);
                    }}
                    data-testid={`consider-btn-${member.id}`}
                    className="h-9 px-4 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 shadow-xs transition-colors cursor-pointer"
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

      {/* Consider Candidate Modal */}
      {isConsiderModalOpen && selectedCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consider-job-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 border border-teal-200 dark:border-teal-800">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="consider-job-modal-title" className="text-base font-semibold text-foreground">
                    Consider Candidate for Open Job
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedCandidate.applicantProfile?.firstName}{' '}
                    {selectedCandidate.applicantProfile?.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConsiderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Select Active Job Posting <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  data-testid="consider-job-select"
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                >
                  <option value="">Select an Open Job Posting...</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      #{j.id}: {j.title} {j.location ? `(${j.location})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg text-xs text-teal-800 dark:text-teal-300">
                Associating this profile creates an active application and runs immediate AI scoring.
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConsiderModalOpen(false)}
                  className="h-10 px-5 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="submit-consider-job-btn"
                  onClick={() => considerMutation.mutate()}
                  disabled={!selectedJobId || considerMutation.isPending}
                  className="h-10 px-5 text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
                >
                  {considerMutation.isPending ? 'Linking...' : 'Confirm Consideration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Contact Interaction Modal */}
      {isContactModalOpen && selectedCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-log-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="contact-log-modal-title" className="text-base font-semibold text-foreground">
                    Record Recruiter Contact Note
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedCandidate.applicantProfile?.firstName}{' '}
                    {selectedCandidate.applicantProfile?.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Related Job Posting <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  data-testid="contact-job-select"
                  value={contactForm.jobPostingId}
                  onChange={(e) => setContactForm({ ...contactForm, jobPostingId: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                >
                  <option value="">Select Job Discussed...</option>
                  {openJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      #{j.id}: {j.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Contact Outcome <span className="text-rose-500">*</span>
                </label>
                <select
                  data-testid="contact-outcome-select"
                  value={contactForm.outcome}
                  onChange={(e) => setContactForm({ ...contactForm, outcome: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                >
                  <option value="INTERESTED">Interested & Available</option>
                  <option value="NOT_INTERESTED">Not Interested in Role</option>
                  <option value="NO_RESPONSE">No Response / Unreachable</option>
                  <option value="UNAVAILABLE">Currently Employed / Unavailable</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Recruiter Notes
                </label>
                <textarea
                  rows={3}
                  data-testid="contact-notes-input"
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  placeholder="Notes from telephone screen, salary expectations, schedule availability..."
                  className="w-full p-3 text-sm bg-background border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y shadow-xs"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="h-10 px-5 text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="submit-contact-log-btn"
                  onClick={() => contactMutation.mutate()}
                  disabled={!contactForm.jobPostingId || contactMutation.isPending}
                  className="h-10 px-5 text-sm font-semibold rounded-lg inline-flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 shadow-xs transition-colors cursor-pointer"
                >
                  {contactMutation.isPending ? 'Saving...' : 'Save Interaction'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
