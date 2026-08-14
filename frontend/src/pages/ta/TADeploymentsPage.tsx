import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Building2,
  MapPin,
  Calendar,
  Search,
  Eye,
  Edit3,
  X,
  CheckCircle2,
  Clock,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { taApi } from '../../lib/api/ta';
import { DeploymentStatus } from '../../lib/types/enums';
import type { Deployment, DeploymentStats, Client } from '../../lib/types/api';

const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Deployments' },
  { key: DeploymentStatus.PENDING_ORIENTATION, label: 'Pending Orientation' },
  { key: DeploymentStatus.DISPATCHED, label: 'Dispatched' },
  { key: DeploymentStatus.ACTIVE, label: 'Active Onsite' },
  { key: DeploymentStatus.ENDED, label: 'Completed / Ended' },
  { key: DeploymentStatus.CANCELLED, label: 'Cancelled' },
];

export default function TADeploymentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Update Status Modal State
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [statusForm, setStatusForm] = useState<{
    status: DeploymentStatus;
    reason: string;
  }>({
    status: DeploymentStatus.ACTIVE,
    reason: '',
  });

  // Queries
  const {
    data: deploymentsRes,
    isLoading: isLoadingDeployments,
    isError: isDeploymentsError,
    error: deploymentsError,
    refetch: refetchDeployments,
  } = useQuery({
    queryKey: ['ta', 'deployments', statusFilter, clientFilter],
    queryFn: () =>
      taApi.listDeployments({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        clientId: clientFilter !== 'ALL' ? parseInt(clientFilter, 10) : undefined,
      }),
  });

  const { data: statsRes } = useQuery({
    queryKey: ['ta', 'deployment-stats'],
    queryFn: () => taApi.getDeploymentStats(),
  });

  const { data: clientsRes } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const deployments: Deployment[] = deploymentsRes?.data || [];
  const stats: DeploymentStats | undefined = statsRes?.data;
  const clients: Client[] = clientsRes?.data || [];

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDeployment) throw new Error('No deployment selected');
      return taApi.updateDeploymentStatus(selectedDeployment.id, {
        status: statusForm.status,
        reason: statusForm.reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Deployment status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployments'] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployment-stats'] });
      setSelectedDeployment(null);
      setStatusForm({ status: DeploymentStatus.ACTIVE, reason: '' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update deployment status';
      toast.error(msg);
    },
  });

  // Filtered list by text search
  const filteredDeployments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return deployments;

    return deployments.filter((d) => {
      const profile = d.employee?.user?.applicantProfile;
      const employeeName = profile
        ? `${profile.firstName} ${profile.lastName}`.toLowerCase()
        : '';
      const empNum = d.employee?.employeeNumber?.toLowerCase() || '';
      const clientName = d.client?.name.toLowerCase() || '';
      const site = d.site?.toLowerCase() || '';

      return (
        employeeName.includes(query) ||
        empNum.includes(query) ||
        clientName.includes(query) ||
        site.includes(query)
      );
    });
  }, [deployments, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Deployments & Site Personnel Management"
        description="Track active staffing assignments, site dispatches, orientation completions, and client headcount placement."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Deployments' }]}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-testid="deployment-stats-cards">
        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Active
            </span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {stats?.totalActiveDeployments ?? deployments.filter((d) => d.status === 'ACTIVE').length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Orientation
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-2">
            {stats?.pendingOrientationCount ??
              deployments.filter((d) => d.status === 'PENDING_ORIENTATION').length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dispatched / Transit
            </span>
            <Send className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {stats?.dispatchedCount ?? deployments.filter((d) => d.status === 'DISPATCHED').length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ended / Returned
            </span>
            <CheckCircle2 className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-2">
            {deployments.filter((d) => d.status === 'ENDED').length}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-4">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {STATUS_FILTERS.map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                data-testid={`tab-deployment-status-${tab.key.toLowerCase()}`}
                onClick={() => setStatusFilter(tab.key)}
                className={`h-9 px-4 text-xs font-semibold rounded-lg transition-all cursor-pointer inline-flex items-center justify-center ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Client Selector & Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-muted-foreground">Client:</span>
            <select
              data-testid="deployment-client-filter"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Partner Accounts</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              data-testid="deployment-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by employee, ID, client, site..."
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
      </div>

      {/* Deployments Table */}
      {isLoadingDeployments ? (
        <LoadingState variant="table" />
      ) : isDeploymentsError ? (
        <ErrorState
          title="Failed to load deployments"
          message={deploymentsError instanceof Error ? deploymentsError.message : 'An error occurred.'}
          onRetry={refetchDeployments}
        />
      ) : filteredDeployments.length === 0 ? (
        <EmptyState
          title="No deployments found"
          description="There are currently no staff deployments matching the active filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
          <table className="w-full text-left text-sm" data-testid="deployments-table">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Client Account</th>
                <th className="px-5 py-4">Site / Facility</th>
                <th className="px-5 py-4">Contract Period</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDeployments.map((deployment) => {
                const profile = deployment.employee?.user?.applicantProfile;
                const employeeName = profile
                  ? `${profile.firstName} ${profile.lastName}`
                  : `Employee #${deployment.employeeId}`;

                return (
                  <tr key={deployment.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        to={`/ta/employees/${deployment.employeeId}`}
                        className="text-sm font-bold text-foreground hover:text-teal-600 transition-colors block"
                      >
                        {employeeName}
                      </Link>
                      <span className="text-xs text-muted-foreground font-mono">
                        {deployment.employee?.employeeNumber || `ID #${deployment.employeeId}`}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        to={`/ta/clients/${deployment.clientId}`}
                        className="text-xs font-semibold text-teal-600 hover:underline block"
                      >
                        {deployment.client?.name || `Client #${deployment.clientId}`}
                      </Link>
                      {deployment.mrf && (
                        <span className="text-xs text-muted-foreground">
                          MRF: {deployment.mrf.title}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs text-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{deployment.site || 'Main Site'}</span>
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {deployment.contractStart
                            ? new Date(deployment.contractStart).toLocaleDateString()
                            : 'N/A'}{' '}
                          -{' '}
                          {deployment.contractEnd
                            ? new Date(deployment.contractEnd).toLocaleDateString()
                            : 'Ongoing'}
                        </span>
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-xs font-semibold px-3 py-1">
                        <StatusBadge status={deployment.status} size="sm" />
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedDeployment(deployment);
                            setStatusForm({
                              status: deployment.status,
                              reason: '',
                            });
                          }}
                          data-testid={`update-deployment-status-btn-${deployment.id}`}
                          className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 text-foreground transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Status</span>
                        </button>

                        <Link
                          to={`/ta/employees/${deployment.employeeId}`}
                          className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>201 File</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Update Deployment Status Modal */}
      {selectedDeployment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deployment-status-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="deployment-status-modal-title" className="text-base font-semibold text-foreground">
                    Update Deployment Status
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedDeployment.employee?.user?.applicantProfile?.firstName}{' '}
                    {selectedDeployment.employee?.user?.applicantProfile?.lastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeployment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateStatusMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  New Status <span className="text-rose-500">*</span>
                </label>
                <select
                  data-testid="deployment-status-select"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as DeploymentStatus })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={DeploymentStatus.PENDING_ORIENTATION}>Pending Orientation</option>
                  <option value={DeploymentStatus.READY}>Ready for Dispatch</option>
                  <option value={DeploymentStatus.DISPATCHED}>Dispatched</option>
                  <option value={DeploymentStatus.ACTIVE}>Active Onsite</option>
                  <option value={DeploymentStatus.ENDED}>Ended / Contract Completed</option>
                  <option value={DeploymentStatus.CANCELLED}>Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason / Operational Notes
                </label>
                <textarea
                  rows={3}
                  data-testid="deployment-status-reason-input"
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="Orientation completed, client site transfer, assignment ended, etc..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedDeployment(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-deployment-status-btn"
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
