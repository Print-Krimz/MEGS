import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  ArrowLeft,
  Edit3,
  MapPin,
  Mail,
  Phone,
  User,
  Layers,
  Users,
  Plus,
  X,
  Eye,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { taApi } from '../../lib/api/ta';
import type { Client, CreateClientInput, CreateMRFInput } from '../../lib/types/api';

export default function TAClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'mrfs' | 'deployments' | 'info'>('mrfs');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateMRFModalOpen, setIsCreateMRFModalOpen] = useState(false);

  // Edit Client Form State
  const [editFormData, setEditFormData] = useState<CreateClientInput>({
    name: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });

  // Create MRF Form State
  const [mrfFormData, setMrfFormData] = useState<{
    title: string;
    headcount: number;
    location: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    targetFillDate: string;
    requiredSkills: string;
    description: string;
  }>({
    title: '',
    headcount: 5,
    location: '',
    priority: 'NORMAL',
    targetFillDate: '',
    requiredSkills: '',
    description: '',
  });

  // Query Client Details
  const {
    data: clientRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'client', clientId],
    queryFn: () => taApi.getClient(clientId),
    enabled: !!clientId,
  });

  const client: Client | undefined = clientRes?.data;

  // Edit Client Mutation
  const updateClientMutation = useMutation({
    mutationFn: (data: Partial<CreateClientInput>) => taApi.updateClient(clientId, data),
    onSuccess: () => {
      toast.success('Client information updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'clients'] });
      setIsEditModalOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update client';
      toast.error(msg);
    },
  });

  // Create MRF Mutation
  const createMRFMutation = useMutation({
    mutationFn: (data: CreateMRFInput) => taApi.createMRF(data),
    onSuccess: () => {
      toast.success('Manpower Request (MRF) created successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrfs'] });
      setIsCreateMRFModalOpen(false);
      setMrfFormData({
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

  const handleOpenEdit = () => {
    if (!client) return;
    setEditFormData({
      name: client.name,
      industry: client.industry || '',
      contactName: client.contactName || '',
      contactEmail: client.contactEmail || '',
      contactPhone: client.contactPhone || '',
      address: client.address || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name.trim()) {
      toast.error('Client organization name is required');
      return;
    }
    updateClientMutation.mutate({
      name: editFormData.name.trim(),
      industry: editFormData.industry?.trim() || undefined,
      contactName: editFormData.contactName?.trim() || undefined,
      contactEmail: editFormData.contactEmail?.trim() || undefined,
      contactPhone: editFormData.contactPhone?.trim() || undefined,
      address: editFormData.address?.trim() || undefined,
    });
  };

  const handleCreateMRFSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrfFormData.title.trim() || mrfFormData.headcount < 1) {
      toast.error('Please provide a valid MRF title and headcount (at least 1)');
      return;
    }
    createMRFMutation.mutate({
      clientId,
      title: mrfFormData.title.trim(),
      headcount: mrfFormData.headcount,
      location: mrfFormData.location.trim() || undefined,
      priority: mrfFormData.priority,
      targetFillDate: mrfFormData.targetFillDate || undefined,
      requiredSkills: mrfFormData.requiredSkills.trim() || undefined,
      description: mrfFormData.description.trim() || undefined,
    });
  };

  if (isLoading) {
    return <LoadingState variant="detail" />;
  }

  if (isError || !client) {
    return (
      <ErrorState
        title="Client Not Found"
        message={error instanceof Error ? error.message : 'The requested client account could not be found.'}
        onRetry={refetch}
      />
    );
  }

  const mrfs = client.manpowerRequests || [];
  const deployments = client.deployments || [];
  const openMRFs = mrfs.filter((m) => m.status === 'OPEN');
  const activeDeployments = deployments.filter((d) => d.status === 'ACTIVE' || d.status === 'DISPATCHED');

  return (
    <div className="space-y-6 pb-12">
      {/* Back Link */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/ta/clients"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Clients</span>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={client.name}
        description={`Client Account #${client.id} • ${client.industry || 'General Industry'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/ta/dashboard' },
          { label: 'Clients', href: '/ta/clients' },
          { label: client.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateMRFModalOpen(true)}
              data-testid="create-mrf-for-client-btn"
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create MRF</span>
            </button>
            <button
              onClick={handleOpenEdit}
              data-testid="edit-client-btn"
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Account</span>
            </button>
          </div>
        }
      />

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Total MRFs
          </span>
          <p className="text-2xl font-bold text-foreground mt-2 flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            <span>{mrfs.length}</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Active Open MRFs
          </span>
          <p className="text-2xl font-bold text-emerald-600 mt-2 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>{openMRFs.length}</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Active Deployed
          </span>
          <p className="text-2xl font-bold text-indigo-600 mt-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>{activeDeployments.length}</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-subtle">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Account Status
          </span>
          <div className="mt-2.5">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              Active Partner
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-6">
        <button
          onClick={() => setActiveTab('mrfs')}
          data-testid="tab-client-mrfs"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'mrfs'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4 text-teal-600" />
          <span>Manpower Requests (MRFs)</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-bold">
            {mrfs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          data-testid="tab-client-deployments"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'deployments'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4 text-indigo-600" />
          <span>Active Deployed Personnel</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
            {deployments.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          data-testid="tab-client-info"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'info'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4 text-slate-500" />
          <span>Company & Contact Info</span>
        </button>
      </div>

      {/* Tab 1: Manpower Requests */}
      {activeTab === 'mrfs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Manpower Requests for {client.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Headcount quotas, progress, and fulfillment tracking.
              </p>
            </div>
            <button
              onClick={() => setIsCreateMRFModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create MRF</span>
            </button>
          </div>

          {mrfs.length === 0 ? (
            <EmptyState
              title="No Manpower Requests yet"
              description="Create an MRF to start fulfilling hiring quotas for this client."
              action={
                <button
                  onClick={() => setIsCreateMRFModalOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create First MRF</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="client-mrfs-list">
              {mrfs.map((mrf) => {
                const deployedCount = mrf._count?.deployments || 0;
                const headcount = mrf.headcount || 1;
                const fillPercent = Math.min(100, Math.round((deployedCount / headcount) * 100));

                return (
                  <div
                    key={mrf.id}
                    data-testid={`mrf-card-${mrf.id}`}
                    className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4 flex flex-col justify-between hover:border-teal-500/50 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/ta/mrfs/${mrf.id}`}
                          className="text-base font-bold text-foreground hover:text-teal-600 transition-colors line-clamp-1"
                        >
                          {mrf.title}
                        </Link>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full uppercase ${
                            mrf.priority === 'URGENT'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              : mrf.priority === 'HIGH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {mrf.priority}
                        </span>
                      </div>

                      {mrf.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{mrf.location}</span>
                        </p>
                      )}

                      {/* Headcount Progress */}
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                          <span>Headcount Fill Progress</span>
                          <span className="font-mono text-teal-600 dark:text-teal-400">
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

                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Target: {mrf.targetFillDate ? new Date(mrf.targetFillDate).toLocaleDateString() : 'N/A'}
                      </span>
                      <Link
                        to={`/ta/mrfs/${mrf.id}`}
                        data-testid={`view-mrf-${mrf.id}`}
                        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors"
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
        </div>
      )}

      {/* Tab 2: Deployed Personnel */}
      {activeTab === 'deployments' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Personnel Deployed at {client.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              Active assignments, deployment locations, and 201 dossiers.
            </p>
          </div>

          {deployments.length === 0 ? (
            <EmptyState
              title="No personnel deployed yet"
              description="When candidates are hired and dispatched to this client's sites, they will appear here."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
              <table className="w-full text-left text-sm" data-testid="client-deployments-table">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Site Location</th>
                    <th className="px-5 py-3.5">Contract Dates</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deployments.map((dep) => {
                    const profile = dep.employee?.user?.applicantProfile;
                    const employeeName = profile
                      ? `${profile.firstName} ${profile.lastName}`
                      : `Employee #${dep.employeeId}`;

                    return (
                      <tr key={dep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-4">
                          <Link
                            to={`/ta/employees/${dep.employeeId}`}
                            className="font-bold text-foreground hover:text-teal-600 transition-colors block"
                          >
                            {employeeName}
                          </Link>
                          <span className="text-xs text-muted-foreground font-mono">
                            {dep.employee?.employeeNumber || `ID #${dep.employeeId}`}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-foreground">
                          {dep.site || 'Main Client Facility'}
                        </td>
                        <td className="px-5 py-4 text-xs text-muted-foreground">
                          {dep.contractStart ? new Date(dep.contractStart).toLocaleDateString() : 'N/A'} -{' '}
                          {dep.contractEnd ? new Date(dep.contractEnd).toLocaleDateString() : 'Ongoing'}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={dep.status} size="sm" />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            to={`/ta/employees/${dep.employeeId}`}
                            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>201 Dossier</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Company & Contact Info */}
      {activeTab === 'info' && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-foreground">Organization Overview</h3>
            <p className="text-xs text-muted-foreground">Detailed contact points and physical address.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Client Name</span>
              <p className="font-semibold text-foreground mt-1 text-base">{client.name}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Industry / Sector</span>
              <p className="font-semibold text-foreground mt-1">{client.industry || 'Not Specified'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Primary Contact Person</span>
              <p className="font-medium text-foreground mt-1 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{client.contactName || 'None assigned'}</span>
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Contact Email</span>
              <p className="font-medium text-foreground mt-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{client.contactEmail || 'None assigned'}</span>
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Contact Phone</span>
              <p className="font-medium text-foreground mt-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{client.contactPhone || 'None assigned'}</span>
              </p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Partner Since</span>
              <p className="font-medium text-foreground mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{new Date(client.createdAt).toLocaleDateString()}</span>
              </p>
            </div>
          </div>

          <div>
            <span className="text-xs font-medium text-muted-foreground block">Headquarters / Site Address</span>
            <p className="font-medium text-foreground mt-1 flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>{client.address || 'No registered address'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {isEditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-client-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="edit-client-modal-title" className="text-base font-semibold text-foreground">
                    Edit Client Account
                  </h3>
                  <p className="text-xs text-muted-foreground">Update client company and contact credentials.</p>
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
                  Client Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="edit-client-name-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Industry / Sector
                </label>
                <input
                  type="text"
                  data-testid="edit-client-industry-input"
                  value={editFormData.industry || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    data-testid="edit-client-contact-name-input"
                    value={editFormData.contactName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    data-testid="edit-client-contact-phone-input"
                    value={editFormData.contactPhone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Contact Email
                </label>
                <input
                  type="email"
                  data-testid="edit-client-contact-email-input"
                  value={editFormData.contactEmail || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Site / Office Address
                </label>
                <textarea
                  rows={2}
                  data-testid="edit-client-address-input"
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
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
                  data-testid="submit-edit-client-btn"
                  disabled={updateClientMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {updateClientMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create MRF for Client Modal */}
      {isCreateMRFModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-mrf-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-xl bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="create-mrf-modal-title" className="text-base font-semibold text-foreground">
                    Create Manpower Request (MRF)
                  </h3>
                  <p className="text-xs text-muted-foreground">Issuing MRF specifically for {client.name}.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateMRFModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMRFSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Position / Request Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="mrf-title-input"
                  value={mrfFormData.title}
                  onChange={(e) => setMrfFormData({ ...mrfFormData, title: e.target.value })}
                  placeholder="e.g. Warehouse Inventory Clerks"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

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
                    value={mrfFormData.headcount}
                    onChange={(e) => setMrfFormData({ ...mrfFormData, headcount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    data-testid="mrf-priority-select"
                    value={mrfFormData.priority}
                    onChange={(e) => setMrfFormData({ ...mrfFormData, priority: e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Deployment Location
                  </label>
                  <input
                    type="text"
                    data-testid="mrf-location-input"
                    value={mrfFormData.location}
                    onChange={(e) => setMrfFormData({ ...mrfFormData, location: e.target.value })}
                    placeholder="e.g. Taguig Site"
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
                    value={mrfFormData.targetFillDate}
                    onChange={(e) => setMrfFormData({ ...mrfFormData, targetFillDate: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Required Skills
                </label>
                <input
                  type="text"
                  data-testid="mrf-skills-input"
                  value={mrfFormData.requiredSkills}
                  onChange={(e) => setMrfFormData({ ...mrfFormData, requiredSkills: e.target.value })}
                  placeholder="e.g. Forklift Operation, WMS, Inventory Auditing"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Special Instructions
                </label>
                <textarea
                  rows={3}
                  data-testid="mrf-description-input"
                  value={mrfFormData.description}
                  onChange={(e) => setMrfFormData({ ...mrfFormData, description: e.target.value })}
                  placeholder="Additional context regarding shifts, client preferences, or requirements..."
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateMRFModalOpen(false)}
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
