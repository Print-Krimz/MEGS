import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Briefcase, 
  Building2, 
  Calendar, 
  MapPin, 
  UserCheck, 
  UploadCloud, 
  FileText, 
  X
} from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { taApi } from '../../../lib/api/ta';
import { DeploymentStatus } from '../../../lib/types/enums';
import type { ApplicationDetail, Client, ManpowerRequest, Deployment } from '../../../lib/types/api';

interface DeploymentTabProps {
  application: ApplicationDetail;
  isDeployModalOpen?: boolean;
  onCloseDeployModal?: () => void;
}

export function DeploymentTab({
  application,
  isDeployModalOpen: externalDeployOpen,
  onCloseDeployModal,
}: DeploymentTabProps) {
  const queryClient = useQueryClient();

  // Internal modals
  const [internalDeployOpen, setInternalDeployOpen] = useState(false);
  const [isUploadDocOpen, setIsUploadDocOpen] = useState(false);

  // Deployment form
  const [clientId, setClientId] = useState<number | ''>('');
  const [mrfId, setMrfId] = useState<number | ''>('');
  const [site, setSite] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [contractEnd, setContractEnd] = useState('');
  const [deployNotes, setDeployNotes] = useState('');

  // Post-hire upload form
  const [postHireLabel, setPostHireLabel] = useState('');
  const [postHireFile, setPostHireFile] = useState<File | null>(null);

  const isModalOpen = Boolean(externalDeployOpen || internalDeployOpen);
  const handleCloseModal = () => {
    setInternalDeployOpen(false);
    if (onCloseDeployModal) onCloseDeployModal();
  };

  // 1. Query Clients & MRFs for dropdowns
  const { data: clientsRes } = useQuery({
    queryKey: ['ta', 'clients'],
    queryFn: () => taApi.listClients(),
  });

  const { data: mrfsRes } = useQuery({
    queryKey: ['ta', 'mrfs'],
    queryFn: () => taApi.listMRFs(),
  });

  // 2. Query Deployments for this application
  const { data: deploymentsRes } = useQuery({
    queryKey: ['ta', 'deployments', application.id],
    queryFn: () => taApi.listDeployments(),
  });

  const clients: Client[] = clientsRes?.data || [];
  const mrfs: ManpowerRequest[] = mrfsRes?.data || [];
  const allDeployments: Deployment[] = deploymentsRes?.data || [];
  const candidateDeployments = allDeployments.filter(
    (d) => d.applicationId === application.id
  );
  const activeDeployment = candidateDeployments[0];

  // 3. Mutation: Start Onboarding
  const onboardMutation = useMutation({
    mutationFn: () => taApi.startOnboarding(application.id),
    onSuccess: () => {
      toast.success('Candidate moved to Onboarding stage');
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to start onboarding');
    },
  });

  // 4. Mutation: Create Deployment
  const createDeployMutation = useMutation({
    mutationFn: () => {
      if (!clientId) throw new Error('Please select a target client');
      return taApi.createDeployment(application.id, {
        clientId: Number(clientId),
        mrfId: mrfId ? Number(mrfId) : undefined,
        site: site || undefined,
        contractStart: contractStart || undefined,
        contractEnd: contractEnd || undefined,
        notes: deployNotes || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Candidate successfully dispatched to deployment');
      handleCloseModal();
      setClientId('');
      setMrfId('');
      setSite('');
      setContractStart('');
      setContractEnd('');
      setDeployNotes('');
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployments', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'pipeline-stats'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to create deployment');
    },
  });

  // 5. Mutation: Update Deployment Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ deploymentId, status }: { deploymentId: number; status: DeploymentStatus }) =>
      taApi.updateDeploymentStatus(deploymentId, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Deployment status updated to ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['ta', 'deployments', application.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to update status');
    },
  });

  // 6. Mutation: Upload Post-Hire Document
  const uploadPostHireMutation = useMutation({
    mutationFn: () => {
      if (!postHireLabel.trim() || !postHireFile) {
        throw new Error('Document label and file are required');
      }
      return taApi.uploadPostHireDocument(application.id, postHireLabel, postHireFile);
    },
    onSuccess: () => {
      toast.success('Post-hire document uploaded to 201 file');
      setIsUploadDocOpen(false);
      setPostHireLabel('');
      setPostHireFile(null);
      queryClient.invalidateQueries({ queryKey: ['ta', 'application', application.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err.message || 'Failed to upload document');
    },
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Open';
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

  return (
    <div className="space-y-6" data-testid="deployment-tab">
      {/* Onboarding & Deployment Command Banner */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Deployment & Post-Hire Operations
          </h3>
          <p className="text-xs text-muted-foreground">
            Manage onboarding transitions, dispatch assignments, and digital 201 documentation.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {application.status === 'HIRED' && (
            <button
              type="button"
              onClick={() => onboardMutation.mutate()}
              disabled={onboardMutation.isPending}
              data-testid="start-onboarding-btn"
              className="h-9 px-4 rounded-lg text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 transition duration-150 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{onboardMutation.isPending ? 'Starting...' : 'Start Onboarding'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setInternalDeployOpen(true)}
            data-testid="open-create-deployment-btn"
            className="h-9 px-4 rounded-lg text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 transition duration-150 inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Create Deployment</span>
          </button>
        </div>
      </div>

      {/* 1. Onboarding & Pre-Deployment Checklist */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-subtle space-y-4" data-testid="onboarding-checklist-section">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-teal-700" />
          <span>Pre-Deployment Onboarding Checklist</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            { id: 'ob-id-badge', label: 'Company ID & Biometrics Badge Issuance' },
            { id: 'ob-statutory', label: 'Statutory Number Verification (SSS/TIN/PhilHealth/Pag-IBIG)' },
            { id: 'ob-contract', label: 'Signed Employment Contract on 201 File' },
            { id: 'ob-orientation', label: 'Client Site Orientation & Safety Induction' },
          ].map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                defaultChecked={application.status === 'HIRED' || application.status === 'DEPLOYED'}
                className="w-5 h-5 rounded border-border text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 2. Active Deployment Tracker */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4" data-testid="deployment-status-tracker">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-teal-700" />
          <span>Active Deployment Assignment</span>
        </h3>

        {!activeDeployment ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-border space-y-2">
            <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-foreground">No Active Deployment Record</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Candidate has not been formally assigned or dispatched to a client site yet.
            </p>
          </div>
        ) : (
          <div className="py-4 px-5 bg-slate-50 dark:bg-slate-800/40 border border-border rounded-xl space-y-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="space-y-1">
                <div className="font-bold text-base text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-teal-700" />
                  <span>{activeDeployment.client?.name || `Client #${activeDeployment.clientId}`}</span>
                </div>
                {activeDeployment.mrf && (
                  <div className="text-xs text-muted-foreground">
                    MRF: <strong className="text-foreground">{activeDeployment.mrf.title}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-3 py-1">
                  <StatusBadge status={activeDeployment.status} size="md" />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Site Location:</span>
                <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeDeployment.site || 'Main Enterprise Site'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Contract Term:</span>
                <div className="font-mono text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {formatDate(activeDeployment.contractStart)} &ndash; {formatDate(activeDeployment.contractEnd)}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground block font-medium">Deployment Record:</span>
                <div className="font-mono text-xs text-muted-foreground">
                  DEP-#{activeDeployment.id}
                </div>
              </div>
            </div>

            {/* Quick Status Update Controls */}
            <div className="pt-3 border-t border-border flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">Update Status:</span>
              {(
                [
                  'PENDING_ORIENTATION',
                  'READY',
                  'DISPATCHED',
                  'ACTIVE',
                  'ENDED',
                ] as DeploymentStatus[]
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    updateStatusMutation.mutate({
                      deploymentId: activeDeployment.id,
                      status: st,
                    })
                  }
                  disabled={
                    activeDeployment.status === st || updateStatusMutation.isPending
                  }
                  className={`h-9 px-3.5 text-xs font-semibold rounded-lg border transition duration-150 cursor-pointer inline-flex items-center justify-center ${
                    activeDeployment.status === st
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Post-Hire Digital 201 Documents */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-700" />
            <span>Digital 201 Post-Hire Vault</span>
          </h3>

          <button
            type="button"
            onClick={() => setIsUploadDocOpen(true)}
            data-testid="upload-posthire-doc-btn"
            className="h-9 px-3.5 rounded-lg text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
        </div>

        {(!application.postHireDocuments || application.postHireDocuments.length === 0) ? (
          <div className="p-6 text-center text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-border">
            No post-hire employment documents (signed employment contract, ID issuance, company property accountability) filed yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {application.postHireDocuments.map((doc) => (
              <div
                key={doc.id}
                className="py-4 px-5 bg-slate-50 dark:bg-slate-800/40 border border-border rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="font-bold text-sm text-foreground truncate">{doc.label}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    Uploaded: {formatDate(doc.createdAt)}
                  </div>
                </div>

                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-border rounded-lg text-xs font-semibold text-teal-800 dark:text-teal-300 inline-flex items-center justify-center transition-colors"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Create Deployment Dispatch Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-teal-700" />
                <span>Create Deployment Assignment</span>
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!clientId) {
                  toast.error('Please choose a client');
                  return;
                }
                createDeployMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="create-deployment-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Enterprise Client <span className="text-rose-500">*</span>
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(Number(e.target.value))}
                  data-testid="deployment-client-select"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Select target client company...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Associated MRF Request (Optional)
                </label>
                <select
                  value={mrfId}
                  onChange={(e) => setMrfId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                >
                  <option value="">Select MRF quota request...</option>
                  {mrfs.map((m) => (
                    <option key={m.id} value={m.id}>
                      MRF-#{m.id}: {m.title} ({m.client?.name || 'Client'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Site / Facility Location
                </label>
                <input
                  type="text"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="e.g. Building 3, Bonifacio Global City, Taguig"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Contract Start Date
                  </label>
                  <input
                    type="date"
                    value={contractStart}
                    onChange={(e) => setContractStart(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Contract End Date
                  </label>
                  <input
                    type="date"
                    value={contractEnd}
                    onChange={(e) => setContractEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Deployment Notes
                </label>
                <textarea
                  rows={2}
                  value={deployNotes}
                  onChange={(e) => setDeployNotes(e.target.value)}
                  placeholder="e.g. Shift schedule, onboarding coordinator contact..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDeployMutation.isPending}
                  data-testid="submit-create-deployment-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {createDeployMutation.isPending ? 'Creating...' : 'Create Deployment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Upload Post-Hire Document Modal */}
      {isUploadDocOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card rounded-xl border border-border shadow-modal overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-teal-700" />
                <span>Upload 201 File Document</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsUploadDocOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                uploadPostHireMutation.mutate();
              }}
              className="space-y-4 text-xs"
              data-testid="upload-posthire-doc-form"
            >
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Document Label / Category <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={postHireLabel}
                  onChange={(e) => setPostHireLabel(e.target.value)}
                  placeholder="e.g. Signed Employment Contract, NDA, Company ID Acknowledgment"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Choose File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.docx"
                  onChange={(e) => setPostHireFile(e.target.files?.[0] || null)}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsUploadDocOpen(false)}
                  className="px-3.5 py-2 rounded-lg font-medium text-slate-700 hover:bg-slate-100 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadPostHireMutation.isPending}
                  data-testid="submit-posthire-upload-btn"
                  className="px-4 py-2 rounded-lg font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 shadow-xs"
                >
                  {uploadPostHireMutation.isPending ? 'Uploading...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
