import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User,
  ArrowLeft,
  Calendar,
  Building2,
  MapPin,
  Mail,
  Phone,
  ShieldCheck,
  FileText,
  Edit3,
  Plus,
  Send,
  X,
  Award,
  AlertCircle,
  FileCheck,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { employeeApi } from '../../lib/api/employees';
import { taApi } from '../../lib/api/ta';
import { EmploymentStatus, EmploymentEventType } from '../../lib/types/enums';
import type {
  Digital201File,
  EmploymentEvent,
  Deployment,
  Client,
} from '../../lib/types/api';

export default function TAEmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'personal' | 'deployments' | 'compliance' | 'timeline'>('personal');

  // Modals
  const [isUpdateStatusModalOpen, setIsUpdateStatusModalOpen] = useState(false);
  const [isNewDeploymentModalOpen, setIsNewDeploymentModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [selectedEndDeployment, setSelectedEndDeployment] = useState<Deployment | null>(null);

  // Status Form State
  const [statusForm, setStatusForm] = useState<{
    status: EmploymentStatus;
    reason: string;
  }>({
    status: EmploymentStatus.ACTIVE,
    reason: '',
  });

  // Deployment Form State
  const [deploymentForm, setDeploymentForm] = useState<{
    clientId: string;
    site: string;
    contractStart: string;
    notes: string;
  }>({
    clientId: '',
    site: '',
    contractStart: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Add Event Form State
  const [eventForm, setEventForm] = useState<{
    eventType: string;
    description: string;
    effectiveDate: string;
  }>({
    eventType: EmploymentEventType.STATUS_CHANGE,
    description: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  // End Deployment Form State
  const [endDeploymentForm, setEndDeploymentForm] = useState<{
    reason: string;
    returnToRedeploymentPool: boolean;
  }>({
    reason: '',
    returnToRedeploymentPool: true,
  });

  // Queries
  const {
    data: dossierRes,
    isLoading: isLoadingDossier,
    isError: isDossierError,
    error: dossierError,
    refetch: refetchDossier,
  } = useQuery({
    queryKey: ['ta', 'employee', employeeId, '201'],
    queryFn: () => employeeApi.getDigital201(employeeId),
    enabled: !!employeeId,
  });

  const {
    data: historyRes,
  } = useQuery({
    queryKey: ['ta', 'employee', employeeId, 'history'],
    queryFn: () => employeeApi.getEmploymentHistory(employeeId),
    enabled: !!employeeId,
  });

  const { data: clientsRes } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const dossier: Digital201File | undefined = dossierRes?.data;
  const historyEvents: EmploymentEvent[] = historyRes?.data || dossier?.employmentEvents || [];
  const clients: Client[] = clientsRes?.data || [];

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      return employeeApi.updateStatus(employeeId, {
        status: statusForm.status,
        reason: statusForm.reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Employment status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'employees'] });
      setIsUpdateStatusModalOpen(false);
      setStatusForm({ status: EmploymentStatus.ACTIVE, reason: '' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(msg);
    },
  });

  const createDeploymentMutation = useMutation({
    mutationFn: async () => {
      if (!deploymentForm.clientId) throw new Error('Please select a client');
      return employeeApi.createDeployment(employeeId, {
        clientId: parseInt(deploymentForm.clientId, 10),
        site: deploymentForm.site.trim() || undefined,
        contractStart: deploymentForm.contractStart || undefined,
        notes: deploymentForm.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Deployment assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployments'] });
      setIsNewDeploymentModalOpen(false);
      setDeploymentForm({
        clientId: '',
        site: '',
        contractStart: new Date().toISOString().split('T')[0],
        notes: '',
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to assign deployment';
      toast.error(msg);
    },
  });

  const endDeploymentMutation = useMutation({
    mutationFn: async (deploymentId: number) => {
      return employeeApi.endDeployment(deploymentId, {
        reason: endDeploymentForm.reason.trim() || undefined,
        returnToRedeploymentPool: endDeploymentForm.returnToRedeploymentPool,
      });
    },
    onSuccess: () => {
      toast.success('Deployment ended and recorded');
      queryClient.invalidateQueries({ queryKey: ['ta', 'employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployments'] });
      setSelectedEndDeployment(null);
      setEndDeploymentForm({ reason: '', returnToRedeploymentPool: true });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to end deployment';
      toast.error(msg);
    },
  });

  const addEventMutation = useMutation({
    mutationFn: async () => {
      if (!eventForm.description.trim()) throw new Error('Event description is required');
      return employeeApi.addEmploymentEvent(employeeId, {
        eventType: eventForm.eventType,
        description: eventForm.description.trim(),
        effectiveDate: eventForm.effectiveDate,
      });
    },
    onSuccess: () => {
      toast.success('Employment audit event logged');
      queryClient.invalidateQueries({ queryKey: ['ta', 'employee', employeeId] });
      setIsAddEventModalOpen(false);
      setEventForm({
        eventType: EmploymentEventType.STATUS_CHANGE,
        description: '',
        effectiveDate: new Date().toISOString().split('T')[0],
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to log event';
      toast.error(msg);
    },
  });

  if (isLoadingDossier) {
    return <LoadingState variant="detail" />;
  }

  if (isDossierError || !dossier) {
    return (
      <ErrorState
        title="Employee File Not Found"
        message={dossierError instanceof Error ? dossierError.message : 'The requested 201 dossier could not be loaded.'}
        onRetry={refetchDossier}
      />
    );
  }

  const employee = dossier.employee;
  const profile = dossier.applicantProfile || employee.user?.applicantProfile;
  const fullName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : employee.user?.email || `Employee #${employee.id}`;
  const deployments = dossier.deployments || [];
  const complianceReqs = dossier.complianceRequirements || [];
  const storedDocs = dossier.storedDocuments || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Back Link */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/ta/employees"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Employee Directory</span>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={fullName}
        description={`Digital 201 Dossier • Employee #${employee.employeeNumber} • ${employee.department || 'Operations'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/ta/dashboard' },
          { label: 'Employees', href: '/ta/employees' },
          { label: employee.employeeNumber },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setStatusForm({ status: employee.status, reason: '' });
                setIsUpdateStatusModalOpen(true);
              }}
              data-testid="update-employee-status-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-card hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-lg transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Update Status</span>
            </button>

            <button
              onClick={() => setIsNewDeploymentModalOpen(true)}
              data-testid="create-deployment-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Assign Deployment</span>
            </button>
          </div>
        }
      />

      {/* Hero 201 Summary Strip */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-xs text-muted-foreground block font-medium">Employment Status</span>
          <div className="mt-1">
            <StatusBadge status={employee.status} size="md" />
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Position & Department</span>
          <p className="text-sm font-semibold text-foreground mt-1">
            {employee.position || 'Staff Member'}
          </p>
          <span className="text-xs text-muted-foreground">{employee.department || 'Operations'}</span>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Hire Date</span>
          <p className="text-sm font-semibold text-foreground mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>{new Date(employee.hireDate).toLocaleDateString()}</span>
          </p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground block font-medium">Active Deployments</span>
          <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-teal-600" />
            <span>
              {deployments.filter((d) => d.status === 'ACTIVE' || d.status === 'DISPATCHED').length} Active Site(s)
            </span>
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab('personal')}
          data-testid="tab-201-personal"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'personal'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4 text-teal-600" />
          <span>Personal Information & Government IDs</span>
        </button>

        <button
          onClick={() => setActiveTab('deployments')}
          data-testid="tab-201-deployments"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'deployments'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-600" />
          <span>Deployments & Assignments ({deployments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          data-testid="tab-201-compliance"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'compliance'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Compliance & Vault Documents ({complianceReqs.length + storedDocs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          data-testid="tab-201-timeline"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer shrink-0 flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 text-amber-600" />
          <span>Employment Events Timeline ({historyEvents.length})</span>
        </button>
      </div>

      {/* Tab 1: Personal Information & Government IDs */}
      {activeTab === 'personal' && (
        <div className="space-y-6 max-w-4xl" data-testid="personal-info-section">
          {/* Government IDs Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-teal-600" />
              <span>Mandatory Government Identification Numbers</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-muted-foreground block font-sans mb-1">
                  SSS Number
                </span>
                <p className="font-mono font-bold text-sm text-foreground">
                  {profile?.sss || 'Not on File'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-muted-foreground block font-sans mb-1">
                  TIN (BIR)
                </span>
                <p className="font-mono font-bold text-sm text-foreground">
                  {profile?.tin || 'Not on File'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-muted-foreground block font-sans mb-1">
                  PhilHealth
                </span>
                <p className="font-mono font-bold text-sm text-foreground">
                  {profile?.philhealth || 'Not on File'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-muted-foreground block font-sans mb-1">
                  Pag-IBIG (HDMF)
                </span>
                <p className="font-mono font-bold text-sm text-foreground">
                  {profile?.pagibig || 'Not on File'}
                </p>
              </div>
            </div>
          </div>

          {/* Contact & Residential Details */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-teal-600" />
              <span>Contact & Residential Address</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Email Address</span>
                <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{employee.user?.email || 'N/A'}</span>
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block font-medium">Mobile Phone</span>
                <p className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{profile?.mobileNumber || 'N/A'}</span>
                </p>
              </div>

              <div className="sm:col-span-2">
                <span className="text-xs text-muted-foreground block font-medium">
                  Residential Address
                </span>
                <p className="font-medium text-foreground mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    {profile?.address ? `${profile.address}, ${profile.city}, ${profile.province}` : 'No address on file'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Emergency Contact</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground block font-medium">Contact Person</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {profile?.emergencyContactName || 'None listed'}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block font-medium">Relationship</span>
                <p className="font-semibold text-foreground mt-0.5">
                  {profile?.emergencyContactRelationship || 'N/A'}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block font-medium">Emergency Phone</span>
                <p className="font-semibold text-foreground mt-0.5 font-mono">
                  {profile?.emergencyContactPhone || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deployments & Assignments */}
      {activeTab === 'deployments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Client Assignments & Site Deployments
              </h3>
              <p className="text-xs text-muted-foreground">
                Historical record of all client work orders, site assignments, and active placements.
              </p>
            </div>
            <button
              onClick={() => setIsNewDeploymentModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign New Deployment</span>
            </button>
          </div>

          {deployments.length === 0 ? (
            <EmptyState
              title="No deployments on record"
              description="Assign this employee to an authorized client site or MRF."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-subtle">
              <table className="w-full text-left text-sm" data-testid="employee-deployments-table">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-5 py-4">Client Account</th>
                    <th className="px-5 py-4">Site / Branch</th>
                    <th className="px-5 py-4">Contract Dates</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deployments.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <Link
                          to={`/ta/clients/${dep.clientId}`}
                          className="text-sm font-bold text-foreground hover:text-teal-600 transition-colors block"
                        >
                          {dep.client?.name || `Client #${dep.clientId}`}
                        </Link>
                        {dep.mrf && (
                          <span className="text-xs text-muted-foreground">MRF: {dep.mrf.title}</span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-xs text-foreground">
                        {dep.site || 'Main Facility'}
                      </td>

                      <td className="px-5 py-4 text-xs text-muted-foreground font-mono">
                        {dep.contractStart ? new Date(dep.contractStart).toLocaleDateString() : 'N/A'} -{' '}
                        {dep.contractEnd ? new Date(dep.contractEnd).toLocaleDateString() : 'Ongoing'}
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-xs font-semibold px-3 py-1">
                          <StatusBadge status={dep.status} size="sm" />
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        {(dep.status === 'ACTIVE' || dep.status === 'DISPATCHED') && (
                          <button
                            onClick={() => {
                              setSelectedEndDeployment(dep);
                              setEndDeploymentForm({ reason: '', returnToRedeploymentPool: true });
                            }}
                            data-testid={`end-deployment-btn-${dep.id}`}
                            className="h-9 px-3.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span>End Deployment</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Compliance & Vault Documents */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          {/* Pre-Employment Compliance Requirements */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Verified Pre-Employment Requirements & Clearances</span>
            </h3>

            {complianceReqs.length === 0 ? (
              <div className="p-4 bg-card border border-border rounded-xl text-xs text-muted-foreground">
                No formal compliance checklist records linked to originating application.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {complianceReqs.map((req) => (
                  <div
                    key={req.id}
                    className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-foreground">{req.documentLabel}</h4>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          req.reviewStatus === 'APPROVED'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {req.reviewStatus}
                      </span>
                    </div>
                    {req.reviewedAt && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Verified: {new Date(req.reviewedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stored Documents Vault */}
          <div className="space-y-3 pt-4 border-t border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <span>Digital 201 Vault Stored Documents</span>
            </h3>

            {storedDocs.length === 0 ? (
              <div className="p-4 bg-card border border-border rounded-xl text-xs text-muted-foreground">
                No electronic document archives stored in Vault 201 bucket for this employee.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {storedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-sm font-bold text-foreground truncate">{doc.originalName}</h4>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                      <span className="uppercase font-semibold">{doc.category}</span>
                      <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Employment Events Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4 max-w-3xl" data-testid="employment-events-section">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Employment Events & Audit Trail
              </h3>
              <p className="text-xs text-muted-foreground">
                Chronological record of status changes, redeployments, promotions, and actions.
              </p>
            </div>
            <button
              onClick={() => setIsAddEventModalOpen(true)}
              data-testid="add-event-btn"
              className="h-9 px-3.5 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Employment Event</span>
            </button>
          </div>

          {historyEvents.length === 0 ? (
            <EmptyState
              title="No events logged yet"
              description="Log milestones, wage changes, transfers, and performance events."
            />
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 space-y-6 my-4">
              {historyEvents.map((evt) => (
                <div key={evt.id} className="relative group">
                  {/* Dot */}
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white dark:border-slate-900 ring-2 ring-teal-200" />

                  <div className="bg-card border border-border rounded-xl p-4 shadow-subtle space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                        {evt.eventType}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(evt.effectiveDate).toLocaleDateString()}</span>
                      </span>
                    </div>

                    <p className="text-sm font-medium text-foreground pt-1">{evt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Update Employment Status Modal */}
      {isUpdateStatusModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-status-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="employee-status-modal-title" className="text-base font-semibold text-foreground">
                    Update Employment Status
                  </h3>
                  <p className="text-xs text-muted-foreground">{fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsUpdateStatusModalOpen(false)}
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
                  Status <span className="text-rose-500">*</span>
                </label>
                <select
                  data-testid="employee-status-select"
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as EmploymentStatus })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={EmploymentStatus.ACTIVE}>Active</option>
                  <option value={EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT}>
                    Redeployment Pool (Available for next placement)
                  </option>
                  <option value={EmploymentStatus.INACTIVE}>Inactive</option>
                  <option value={EmploymentStatus.SEPARATED}>Separated</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Status Change
                </label>
                <textarea
                  rows={3}
                  data-testid="employee-status-reason-input"
                  value={statusForm.reason}
                  onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                  placeholder="Completed contract, voluntary leave, transfer to standby pool..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUpdateStatusModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-employee-status-btn"
                  disabled={updateStatusMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {updateStatusMutation.isPending ? 'Updating...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Deployment Modal */}
      {isNewDeploymentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-deployment-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="new-deployment-modal-title" className="text-base font-semibold text-foreground">
                    Assign Site Deployment
                  </h3>
                  <p className="text-xs text-muted-foreground">{fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewDeploymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDeploymentMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Client Account <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  data-testid="deployment-client-select"
                  value={deploymentForm.clientId}
                  onChange={(e) => setDeploymentForm({ ...deploymentForm, clientId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Client Account...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Site / Facility Location
                </label>
                <input
                  type="text"
                  data-testid="deployment-site-input"
                  value={deploymentForm.site}
                  onChange={(e) => setDeploymentForm({ ...deploymentForm, site: e.target.value })}
                  placeholder="e.g. BGC Logistics Center"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Contract Start Date
                </label>
                <input
                  type="date"
                  data-testid="deployment-start-date-input"
                  value={deploymentForm.contractStart}
                  onChange={(e) => setDeploymentForm({ ...deploymentForm, contractStart: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewDeploymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-new-deployment-btn"
                  disabled={createDeploymentMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {createDeploymentMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* End Deployment Modal */}
      {selectedEndDeployment && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-deployment-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <h3 id="end-deployment-modal-title" className="text-base font-bold text-foreground">
                End Site Deployment
              </h3>
              <p className="text-xs text-muted-foreground">
                Conclude assignment at {selectedEndDeployment.client?.name || 'Client'}.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for Ending Assignment
                </label>
                <textarea
                  rows={3}
                  data-testid="end-deployment-reason-input"
                  value={endDeploymentForm.reason}
                  onChange={(e) => setEndDeploymentForm({ ...endDeploymentForm, reason: e.target.value })}
                  placeholder="Contract term completed, site downscaled, transfer requested..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="returnRedeploy"
                  checked={endDeploymentForm.returnToRedeploymentPool}
                  onChange={(e) =>
                    setEndDeploymentForm({
                      ...endDeploymentForm,
                      returnToRedeploymentPool: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-teal-600 rounded"
                />
                <label htmlFor="returnRedeploy" className="text-xs font-semibold text-foreground cursor-pointer">
                  Return employee to Redeployment Pool for next assignment
                </label>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedEndDeployment(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-testid="confirm-end-deployment-btn"
                  onClick={() => endDeploymentMutation.mutate(selectedEndDeployment.id)}
                  disabled={endDeploymentMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {endDeploymentMutation.isPending ? 'Ending...' : 'End Deployment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Employment Event Modal */}
      {isAddEventModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-event-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="add-event-modal-title" className="text-base font-semibold text-foreground">
                    Record Employment Event
                  </h3>
                  <p className="text-xs text-muted-foreground">{fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEventModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEventMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Event Type <span className="text-rose-500">*</span>
                </label>
                <select
                  data-testid="event-type-select"
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm({ ...eventForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value={EmploymentEventType.STATUS_CHANGE}>Status Change / Transfer</option>
                  <option value={EmploymentEventType.DEPLOYED}>Site Deployment</option>
                  <option value={EmploymentEventType.REDEPLOYED}>Redeployed</option>
                  <option value={EmploymentEventType.ASSIGNMENT_ENDED}>Assignment Ended</option>
                  <option value={EmploymentEventType.SEPARATED}>Separation / Exit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Effective Date
                </label>
                <input
                  type="date"
                  data-testid="event-date-input"
                  value={eventForm.effectiveDate}
                  onChange={(e) => setEventForm({ ...eventForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Event Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  data-testid="event-description-input"
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Promoted to Shift Lead, transferred to BGC branch, commendation noted..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddEventModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-event-btn"
                  disabled={addEventMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {addEventMutation.isPending ? 'Logging...' : 'Log Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
