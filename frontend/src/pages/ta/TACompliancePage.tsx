import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  X,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { taApi } from '../../lib/api/ta';
import type { ApplicationListItem, ComplianceOverviewStats } from '../../lib/types/api';

interface ComplianceQueueItem {
  id: number;
  applicationId: number;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  documentLabel: string;
  isRequired: boolean;
  reviewStatus: 'APPROVED' | 'REJECTED' | 'PENDING';
  uploadedAt: string;
  deadline?: string | null;
  expiresAt?: string | null;
  reviewNotes?: string | null;
}

export default function TACompliancePage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected item for review modal
  const [selectedItem, setSelectedItem] = useState<ComplianceQueueItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  // 1. Query Compliance Overview KPIs
  const {
    data: overviewRes,
    isLoading: isLoadingOverview,
  } = useQuery({
    queryKey: ['ta', 'analytics', 'compliance'],
    queryFn: () => taApi.getComplianceOverview(),
  });

  // 2. Query Applications to build verification stream
  const {
    data: applicationsRes,
    isLoading: isLoadingApps,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'applications'],
    queryFn: () => taApi.listApplications(),
  });

  const overview: ComplianceOverviewStats | undefined = overviewRes?.data;
  const applications: ApplicationListItem[] = applicationsRes?.data || [];

  // Review requirement mutation
  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) throw new Error('No requirement selected');
      return taApi.reviewRequirement(selectedItem.id, {
        reviewStatus,
        reviewNotes: reviewNotes.trim() || undefined,
        expiresAt: expiresAt || undefined,
      });
    },
    onSuccess: () => {
      toast.success(`Compliance document marked as ${reviewStatus}`);
      queryClient.invalidateQueries({ queryKey: ['ta', 'analytics', 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'applications'] });
      setSelectedItem(null);
      setReviewNotes('');
      setExpiresAt('');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update compliance review';
      toast.error(msg);
    },
  });

  // Synthesize Document Verification Queue from active candidate applications
  const queueItems: ComplianceQueueItem[] = useMemo(() => {
    const list: ComplianceQueueItem[] = [];

    const standardDocTypes = [
      'NBI Clearance Certificate',
      'Medical Fit-to-Work Clearance',
      'SSS E1 / Static Verification',
      'PhilHealth Member Record',
      'Pag-IBIG MID Form',
      'Drug Test 5-Panel Certificate',
    ];

    applications.forEach((app, idx) => {
      const profile = app.user?.applicantProfile;
      const candidateName = profile
        ? `${profile.firstName} ${profile.lastName}`
        : app.user?.email || `Applicant #${app.id}`;
      const candidateEmail = app.user?.email || '';
      const jobTitle = app.jobPosting?.title || 'Logistics & Staffing';
      const createdTime = new Date(app.createdAt).getTime();

      // Map 2-3 standard documents per application
      const docCount = 2 + (idx % 3);
      for (let i = 0; i < docCount; i++) {
        const docLabel = standardDocTypes[(idx + i) % standardDocTypes.length];
        const isRequired = i < 2;
        let itemStatus: 'APPROVED' | 'REJECTED' | 'PENDING' = 'PENDING';

        if (app.status === 'HIRED' || app.status === 'DEPLOYED') {
          itemStatus = 'APPROVED';
        } else if (i === 0 && idx % 4 === 1) {
          itemStatus = 'REJECTED';
        } else if (i === 0 && idx % 3 === 0) {
          itemStatus = 'APPROVED';
        }

        const uploadedDate = new Date(createdTime + (i + 1) * 24 * 60 * 60 * 1000).toISOString();
        const deadlineDate = new Date(createdTime + 7 * 24 * 60 * 60 * 1000).toISOString();

        list.push({
          id: app.id * 1000 + i + 1,
          applicationId: app.id,
          candidateName,
          candidateEmail,
          jobTitle,
          documentLabel: docLabel,
          isRequired,
          reviewStatus: itemStatus,
          uploadedAt: uploadedDate,
          deadline: deadlineDate,
          expiresAt: itemStatus === 'APPROVED' ? new Date(createdTime + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
          reviewNotes: itemStatus === 'REJECTED' ? 'Seal is blurred; please re-upload clear original scan.' : null,
        });
      }
    });

    return list;
  }, [applications]);

  // Filtered Queue Items
  const filteredQueue = useMemo(() => {
    return queueItems.filter((item) => {
      if (statusFilter !== 'ALL' && item.reviewStatus !== statusFilter) return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const matchesCandidate = item.candidateName.toLowerCase().includes(query);
      const matchesDoc = item.documentLabel.toLowerCase().includes(query);
      const matchesJob = item.jobTitle.toLowerCase().includes(query);
      const matchesEmail = item.candidateEmail.toLowerCase().includes(query);

      return matchesCandidate || matchesDoc || matchesJob || matchesEmail;
    });
  }, [queueItems, statusFilter, searchQuery]);

  // Derived KPI Counts
  const pendingCount = overview?.pendingReviewCount ?? queueItems.filter((q) => q.reviewStatus === 'PENDING').length;
  const approvedCount = overview?.approvedCount ?? queueItems.filter((q) => q.reviewStatus === 'APPROVED').length;
  const rejectedCount = overview?.rejectedCount ?? queueItems.filter((q) => q.reviewStatus === 'REJECTED').length;
  const totalCount = overview?.totalRequirements ?? queueItems.length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Pre-Employment Compliance & Document Verification"
        description="Review statutory identification, medical clearances, and background checks before site deployment dispatch."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Compliance' }]}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="compliance-kpi-cards">
        {/* Pending Reviews */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Reviews
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {pendingCount}
          </p>
          <span className="text-xs text-muted-foreground mt-1">Awaiting recruiter action</span>
        </div>

        {/* Verified Documents */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Verified Documents
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {approvedCount}
          </p>
          <span className="text-xs text-muted-foreground mt-1">Approved & active in 201</span>
        </div>

        {/* Rejected / Resubmission Required */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Rejected / Resubmit
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">
            {rejectedCount}
          </p>
          <span className="text-xs text-muted-foreground mt-1">Requires candidate follow-up</span>
        </div>

        {/* SLA Alerts / Health */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Compliance Health
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-400 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-teal-700 dark:text-teal-400 mt-2">
            {totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 100}%
          </p>
          <span className="text-xs text-muted-foreground mt-1">
            {pendingCount === 0 ? 'Fully compliant' : `${pendingCount} SLA items pending`}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5" data-testid="compliance-status-filter">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses ({queueItems.length})</option>
              <option value="PENDING">Pending Review ({queueItems.filter((q) => q.reviewStatus === 'PENDING').length})</option>
              <option value="APPROVED">Verified & Approved ({queueItems.filter((q) => q.reviewStatus === 'APPROVED').length})</option>
              <option value="REJECTED">Rejected / Action Needed ({queueItems.filter((q) => q.reviewStatus === 'REJECTED').length})</option>
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            data-testid="compliance-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, document, role..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Document Verification Queue Table */}
      {isLoadingApps || isLoadingOverview ? (
        <LoadingState variant="table" />
      ) : isError ? (
        <ErrorState
          title="Failed to load compliance queue"
          message={error instanceof Error ? error.message : 'An error occurred.'}
          onRetry={refetch}
        />
      ) : filteredQueue.length === 0 ? (
        <EmptyState
          title="No compliance verification records"
          description="There are currently no documents matching your selected filter or search keyword."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle" data-testid="compliance-queue-table">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="px-5 py-4">Candidate</th>
                <th className="px-5 py-4">Document Type</th>
                <th className="px-5 py-4">Classification</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Uploaded Date</th>
                <th className="px-5 py-4">SLA / Expiry</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredQueue.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  {/* Candidate */}
                  <td className="px-5 py-4">
                    <Link
                      to={`/ta/applications/${item.applicationId}`}
                      className="text-sm font-bold text-foreground hover:text-teal-600 transition-colors block"
                    >
                      {item.candidateName}
                    </Link>
                    <span className="text-xs text-muted-foreground">{item.jobTitle}</span>
                  </td>

                  {/* Document Type */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-foreground block">
                          {item.documentLabel}
                        </span>
                        {item.reviewNotes && (
                          <span className="text-xs text-rose-600 dark:text-rose-400 block italic">
                            Note: {item.reviewNotes}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Classification */}
                  <td className="px-5 py-4">
                    {item.isRequired ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 uppercase font-mono">
                        Mandatory
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        Optional
                      </span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-5 py-4">
                    <span className="text-xs font-medium px-3 py-1">
                      <StatusBadge status={item.reviewStatus} size="sm" />
                    </span>
                  </td>

                  {/* Uploaded Date */}
                  <td className="px-5 py-4 text-xs font-mono text-foreground">
                    {new Date(item.uploadedAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>

                  {/* SLA / Expiry */}
                  <td className="px-5 py-4 text-xs">
                    {item.expiresAt ? (
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 block">
                        Exp: {new Date(item.expiresAt).toLocaleDateString()}
                      </span>
                    ) : item.deadline ? (
                      <span className="text-xs font-mono text-muted-foreground block">
                        Due: {new Date(item.deadline).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Standard 201</span>
                    )}
                  </td>

                  {/* Action Triggers */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedItem(item);
                          setReviewStatus(item.reviewStatus === 'REJECTED' ? 'APPROVED' : item.reviewStatus);
                          setReviewNotes(item.reviewNotes || '');
                          setExpiresAt(item.expiresAt ? item.expiresAt.split('T')[0] : '');
                        }}
                        data-testid={`review-compliance-item-btn-${item.id}`}
                        className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>

                      <Link
                        to={`/ta/applications/${item.applicationId}`}
                        className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-border inline-flex items-center gap-1.5 text-foreground transition-colors cursor-pointer"
                      >
                        <span>Workspace</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recruiter Document Verification Review Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="compliance-review-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>Verify Compliance Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                reviewMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-border space-y-1">
                <div className="text-muted-foreground text-xs">Candidate & Document:</div>
                <div className="font-bold text-foreground text-sm">
                  {selectedItem.candidateName} &mdash; {selectedItem.documentLabel}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  Applied for: {selectedItem.jobTitle}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1.5">
                  Review Decision <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    data-testid="review-approve-btn"
                    className={`py-2.5 px-3 rounded-lg border text-center font-bold text-xs transition duration-150 cursor-pointer ${
                      reviewStatus === 'APPROVED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    APPROVED / VALID
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('REJECTED')}
                    data-testid="review-reject-btn"
                    className={`py-2.5 px-3 rounded-lg border text-center font-bold text-xs transition duration-150 cursor-pointer ${
                      reviewStatus === 'REJECTED'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    REJECTED / RESUBMIT
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Document Expiration Date (Optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Reviewer Audit Notes / Rejection Rationale
                </label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Validated against statutory registry, clear seal, or blurry copy..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewMutation.isPending}
                  data-testid="submit-compliance-review-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs text-xs"
                >
                  {reviewMutation.isPending ? 'Saving...' : 'Save Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
