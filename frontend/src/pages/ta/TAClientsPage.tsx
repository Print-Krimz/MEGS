import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Mail,
  Phone,
  User,
  Layers,
  Users,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { taApi } from '../../lib/api/ta';
import type { Client, CreateClientInput } from '../../lib/types/api';

export default function TAClientsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateClientInput>({
    name: '',
    industry: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
  });

  // Queries
  const {
    data: clientsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const clients: Client[] = clientsRes?.data || [];

  // Create Client Mutation
  const createClientMutation = useMutation({
    mutationFn: (data: CreateClientInput) => taApi.createClient(data),
    onSuccess: () => {
      toast.success('Client registered successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'clients'] });
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        industry: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        address: '',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to register client';
      toast.error(msg);
    },
  });

  // Filtered Clients
  const filteredClients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) => {
      const matchesName = client.name.toLowerCase().includes(query);
      const matchesIndustry = client.industry?.toLowerCase().includes(query) || false;
      const matchesContact = client.contactName?.toLowerCase().includes(query) || false;
      const matchesEmail = client.contactEmail?.toLowerCase().includes(query) || false;
      const matchesAddress = client.address?.toLowerCase().includes(query) || false;

      return matchesName || matchesIndustry || matchesContact || matchesEmail || matchesAddress;
    });
  }, [clients, searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Client organization name is required');
      return;
    }
    createClientMutation.mutate({
      name: formData.name.trim(),
      industry: formData.industry?.trim() || undefined,
      contactName: formData.contactName?.trim() || undefined,
      contactEmail: formData.contactEmail?.trim() || undefined,
      contactPhone: formData.contactPhone?.trim() || undefined,
      address: formData.address?.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <PageHeader
        title="Client Accounts Management"
        description="Partner organizations, hiring accounts, manpower quota requests, and active site deployments."
        breadcrumbs={[{ label: 'Dashboard', href: '/ta/dashboard' }, { label: 'Clients' }]}
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            data-testid="add-client-btn"
            className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add New Client</span>
          </button>
        }
      />

      {/* Search & Statistics Bar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-subtle flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="w-4 h-4 text-teal-600" />
          <span>{clients.length} Registered Partner Accounts</span>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            data-testid="client-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, industry, contact..."
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

      {/* Main Content */}
      {isLoading ? (
        <LoadingState variant="page" />
      ) : isError ? (
        <ErrorState
          title="Failed to load client accounts"
          message={error instanceof Error ? error.message : 'An error occurred while fetching clients.'}
          onRetry={refetch}
        />
      ) : filteredClients.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching clients found' : 'No client accounts yet'}
          description={
            searchQuery
              ? 'Try modifying your search keywords or clearing filters.'
              : 'Add your first enterprise or partner client to begin issuing Manpower Requests (MRFs).'
          }
          action={
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Client</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-testid="clients-grid">
          {filteredClients.map((client) => {
            const mrfCount = client.manpowerRequests?.length ?? 0;
            const deploymentCount = client.deployments?.length ?? 0;

            return (
              <div
                key={client.id}
                data-testid={`client-card-${client.id}`}
                className="bg-card border border-border hover:border-teal-500/50 rounded-xl p-6 shadow-subtle hover:shadow-card transition-all duration-200 flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  {/* Card Top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    {client.industry && (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {client.industry}
                      </span>
                    )}
                  </div>

                  {/* Client Name */}
                  <div>
                    <Link
                      to={`/ta/clients/${client.id}`}
                      className="text-lg font-bold text-foreground group-hover:text-teal-600 transition-colors line-clamp-1"
                    >
                      {client.name}
                    </Link>
                    {client.address && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{client.address}</span>
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="pt-2 border-t border-border space-y-1.5 text-sm text-foreground/80">
                    {client.contactName && (
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{client.contactName}</span>
                      </p>
                    )}
                    {client.contactEmail && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{client.contactEmail}</span>
                      </p>
                    )}
                    {client.contactPhone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{client.contactPhone}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Metrics & Detail Link */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <Layers className="w-4 h-4 text-teal-600" />
                      <span>{mrfCount} MRFs</span>
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>{deploymentCount} Deployed</span>
                    </span>
                  </div>

                  <Link
                    to={`/ta/clients/${client.id}`}
                    data-testid={`view-client-${client.id}`}
                    className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Account</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Client Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-client-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="add-client-modal-title" className="text-base font-semibold text-foreground">
                    Register Client Account
                  </h3>
                  <p className="text-xs text-muted-foreground">Add employer details and primary contact person.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Client / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="client-name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Megaworld Logistics Global"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Industry / Business Sector
                </label>
                <input
                  type="text"
                  data-testid="client-industry-input"
                  value={formData.industry || ''}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g. Logistics & Supply Chain, Retail Operations"
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
                    data-testid="client-contact-name-input"
                    value={formData.contactName || ''}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    placeholder="e.g. Jane Doe"
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    data-testid="client-contact-phone-input"
                    value={formData.contactPhone || ''}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="e.g. 09171234567"
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
                  data-testid="client-contact-email-input"
                  value={formData.contactEmail || ''}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  placeholder="e.g. hr@clientcompany.com"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Office / Site Address
                </label>
                <textarea
                  rows={2}
                  data-testid="client-address-input"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 12th Floor, Tower 1, BGC, Taguig City"
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={createClientMutation.isPending}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-client-btn"
                  disabled={createClientMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {createClientMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Register Client</span>
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
