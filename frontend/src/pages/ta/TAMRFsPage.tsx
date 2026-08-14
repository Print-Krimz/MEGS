import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Search,
  Building2,
  MapPin,
  Calendar,
  Eye,
  X,
  Sparkles,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { taApi } from '../../lib/api/ta';
import type { ManpowerRequest, Client, CreateMRFInput } from '../../lib/types/api';

const PRIORITY_TABS = [
  { key: 'ALL', label: 'All Priorities' },
  { key: 'URGENT', label: 'Urgent' },
  { key: 'HIGH', label: 'High' },
  { key: 'NORMAL', label: 'Normal' },
  { key: 'LOW', label: 'Low' },
];

export default function TAMRFsPage() {
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    clientId: string;
    title: string;
    headcount: number;
    location: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    targetFillDate: string;
    requiredSkills: string;
    description: string;
  }>({
    clientId: '',
    title: '',
    headcount: 5,
    location: '',
    priority: 'NORMAL',
    targetFillDate: '',
    requiredSkills: '',
    description: '',
  });

  // Queries
  const {
    data: mrfsRes,
    isLoading: isLoadingMRFs,
    isError: isMRFsError,
    error: mrfsError,
    refetch: refetchMRFs,
  } = useQuery({
    queryKey: ['ta', 'mrfs'],
    queryFn: () => taApi.listMRFs(),
  });

  const { data: clientsRes } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const mrfs: ManpowerRequest[] = mrfsRes?.data || [];
  const clients: Client[] = clientsRes?.data || [];

  // Create MRF Mutation
  const createMRFMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateMRFInput = {
        clientId: parseInt(formData.clientId, 10),
        title: formData.title.trim(),
        headcount: formData.headcount,
        location: formData.location.trim() || undefined,
        priority: formData.priority,
        targetFillDate: formData.targetFillDate || undefined,
        requiredSkills: formData.requiredSkills.trim() || undefined,
        description: formData.description.trim() || undefined,
      };
      return taApi.createMRF(payload);
    },
    onSuccess: () => {
      toast.success('Manpower Request (MRF) created successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrfs'] });
      setIsCreateModalOpen(false);
      setFormData({
        clientId: '',
        title: '',
        headcount: 5,
        location: '',
        priority: 'NORMAL',
        targetFillDate: '',
        requiredSkills: '',
        description: '',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create MRF';
      toast.error(msg);
    },
  });

  // Filtered MRFs
  const filteredMRFs = useMemo(() => {
    return mrfs.filter((mrf) => {
      const matchesPriority = priorityFilter === 'ALL' || mrf.priority === priorityFilter;
      if (!matchesPriority) return false;

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;

      const matchesTitle = mrf.title.toLowerCase().includes(query);
      const matchesClient = mrf.client?.name.toLowerCase().includes(query) || false;
      const matchesLocation = mrf.location?.toLowerCase().includes(query) || false;
      const matchesSkills = mrf.requiredSkills?.toLowerCase().includes(query) || false;

      return matchesTitle || matchesClient || matchesLocation || matchesSkills;
    });
  }, [mrfs, priorityFilter, searchQuery]);

  // Priority counts
  const counts = useMemo(() => {
    return {
      all: mrfs.length,
      urgent: mrfs.filter((m) => m.priority === 'URGENT').length,
      high: mrfs.filter((m) => m.priority === 'HIGH').length,
      normal: mrfs.filter((m) => m.priority === 'NORMAL').length,
      low: mrfs.filter((m) => m.priority === 'LOW').length,
    };
  }, [mrfs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      toast.error('Please select a client organization');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('MRF title is required');
      return;
    }
    if (formData.headcount < 1) {
      toast.error('Headcount quota must be at least 1');
      return;
    }
    createMRFMutation.mutate();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Manpower Requests (MRF)"
        description="Track hiring quotas, client staffing authorizations, fulfillment velocity, and compliance requirements."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'MRFs' }]}
        actions={
          <button
            onClick={() => setIsCreateModalOpen(true)}
            data-testid="create-mrf-btn"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create MRF</span>
          </button>
        }
      />

      {/* Priority Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total MRFs</span>
            <Layers className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-2">{counts.all}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Urgent Quotas</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{counts.urgent}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">High Priority</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">{counts.high}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Normal / Standard</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">{counts.normal + counts.low}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Priority Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            {PRIORITY_TABS.map((tab) => {
              const count =
                tab.key === 'ALL'
                  ? counts.all
                  : tab.key === 'URGENT'
                  ? counts.urgent
                  : tab.key === 'HIGH'
                  ? counts.high
                  : tab.key === 'NORMAL'
                  ? counts.normal
                  : counts.low;
              const isActive = priorityFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  data-testid={`tab-priority-${tab.key.toLowerCase()}`}
                  onClick={() => setPriorityFilter(tab.key)}
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
              data-testid="mrf-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, client, location, skills..."
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

      {/* Main Content */}
      {isLoadingMRFs ? (
        <LoadingState variant="page" />
      ) : isMRFsError ? (
        <ErrorState
          title="Failed to load MRFs"
          message={mrfsError instanceof Error ? mrfsError.message : 'An error occurred while fetching requests.'}
          onRetry={refetchMRFs}
        />
      ) : filteredMRFs.length === 0 ? (
        <EmptyState
          title={searchQuery || priorityFilter !== 'ALL' ? 'No matching MRFs found' : 'No manpower requests yet'}
          description={
            searchQuery || priorityFilter !== 'ALL'
              ? 'Try modifying your search criteria or switching priority filters.'
              : 'Create your first Manpower Request (MRF) to authorize staffing and link job postings.'
          }
          action={
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create MRF</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="mrfs-grid">
          {filteredMRFs.map((mrf) => {
            const deployedCount = mrf._count?.deployments || 0;
            const headcount = mrf.headcount || 1;
            const fillPercent = Math.min(100, Math.round((deployedCount / headcount) * 100));

            return (
              <div
                key={mrf.id}
                data-testid={`mrf-card-${mrf.id}`}
                className="bg-card border border-border hover:border-teal-500/50 rounded-xl p-6 shadow-subtle hover:shadow-card transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Top: Priority & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                        mrf.priority === 'URGENT'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                          : mrf.priority === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                          : mrf.priority === 'LOW'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          : 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                      }`}
                    >
                      {mrf.priority} Priority
                    </span>

                    <span className="text-xs font-semibold text-muted-foreground font-mono">
                      MRF #{mrf.id}
                    </span>
                  </div>

                  {/* Title & Client */}
                  <div>
                    <Link
                      to={`/ta/mrfs/${mrf.id}`}
                      className="text-base font-bold text-foreground group-hover:text-teal-600 transition-colors line-clamp-1"
                    >
                      {mrf.title}
                    </Link>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="line-clamp-1">{mrf.client?.name || 'Client Account'}</span>
                    </p>
                  </div>

                  {/* Location & Target Date */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {mrf.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{mrf.location}</span>
                      </div>
                    )}
                    {mrf.targetFillDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Target: {new Date(mrf.targetFillDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Headcount Fill Ratio Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Fulfillment Ratio</span>
                      <span className="font-mono text-teal-600 dark:text-teal-400 font-bold">
                        {deployedCount} / {headcount} ({fillPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-teal-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Strip */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Created: {new Date(mrf.createdAt).toLocaleDateString()}
                  </span>

                  <Link
                    to={`/ta/mrfs/${mrf.id}`}
                    data-testid={`view-mrf-${mrf.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold rounded-lg bg-teal-50 text-teal-900 border border-teal-200 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:border-teal-800 dark:hover:bg-teal-900 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View MRF</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create MRF Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-mrf-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="create-mrf-modal-title" className="text-base font-semibold text-foreground">
                    Create Manpower Request (MRF)
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Specify client authorization, quota headcount, and required skillset.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Client / Employer <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  data-testid="mrf-client-select"
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                >
                  <option value="">Select a Client Organization...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.industry ? `(${c.industry})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Position / Request Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="mrf-title-input"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Warehouse Operations Personnel"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Headcount and Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Headcount Quota <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    data-testid="mrf-headcount-input"
                    value={formData.headcount}
                    onChange={(e) => setFormData({ ...formData, headcount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    data-testid="mrf-priority-select"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Location and Target Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Deployment Location
                  </label>
                  <input
                    type="text"
                    data-testid="mrf-location-input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Taguig City, Metro Manila"
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Fill Date
                  </label>
                  <input
                    type="date"
                    data-testid="mrf-target-date-input"
                    value={formData.targetFillDate}
                    onChange={(e) => setFormData({ ...formData, targetFillDate: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              {/* Required Skills */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Required Skills & Qualifications
                </label>
                <input
                  type="text"
                  data-testid="mrf-skills-input"
                  value={formData.requiredSkills}
                  onChange={(e) => setFormData({ ...formData, requiredSkills: e.target.value })}
                  placeholder="e.g. Forklift Operation, WMS, Inventory Control, Heavy Lifting"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Special Instructions
                </label>
                <textarea
                  rows={3}
                  data-testid="mrf-description-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Additional context on shifts, client facilities, overtime policies..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-mrf-btn"
                  disabled={createMRFMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {createMRFMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Create MRF</span>
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
