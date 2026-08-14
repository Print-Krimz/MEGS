import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Briefcase,
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  Eye,
  X,
  FileCheck,
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { taApi } from '../../lib/api/ta';
import { JobStatus } from '../../lib/types/enums';
import type {
  ManpowerRequest,
  MRFComplianceTemplate,
  CreateComplianceTemplateInput,
  CreateJobInput,
} from '../../lib/types/api';

export default function TAMRFDetailPage() {
  const { id } = useParams<{ id: string }>();
  const mrfId = parseInt(id || '0', 10);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'jobs' | 'compliance' | 'specs' | 'timeline'>('jobs');
  const [isAddTemplateModalOpen, setIsAddTemplateModalOpen] = useState(false);
  const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);

  // Template Form State
  const [templateForm, setTemplateForm] = useState<CreateComplianceTemplateInput>({
    documentLabel: '',
    isRequired: true,
  });

  // Create Job Form State
  const [jobForm, setJobForm] = useState<{
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
    data: mrfRes,
    isLoading: isLoadingMRF,
    isError: isMRFError,
    error: mrfError,
    refetch: refetchMRF,
  } = useQuery({
    queryKey: ['ta', 'mrf', mrfId],
    queryFn: () => taApi.getMRF(mrfId),
    enabled: !!mrfId,
  });

  const {
    data: templatesRes,
    isLoading: isLoadingTemplates,
  } = useQuery({
    queryKey: ['ta', 'mrf', mrfId, 'compliance-templates'],
    queryFn: () => taApi.listMRFComplianceTemplates(mrfId),
    enabled: !!mrfId,
  });

  const mrf: ManpowerRequest | undefined = mrfRes?.data;
  const templates: MRFComplianceTemplate[] = templatesRes?.data || mrf?.complianceTemplates || [];

  // Mutations
  const addTemplateMutation = useMutation({
    mutationFn: (data: CreateComplianceTemplateInput) =>
      taApi.createComplianceTemplate(mrfId, data),
    onSuccess: () => {
      toast.success('Compliance requirement template added successfully');
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrf', mrfId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrf', mrfId, 'compliance-templates'] });
      setIsAddTemplateModalOpen(false);
      setTemplateForm({ documentLabel: '', isRequired: true });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to add compliance template';
      toast.error(msg);
    },
  });

  const removeTemplateMutation = useMutation({
    mutationFn: (templateId: number) => taApi.removeMRFComplianceTemplate(templateId),
    onSuccess: () => {
      toast.success('Compliance requirement removed');
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrf', mrfId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrf', mrfId, 'compliance-templates'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to remove template';
      toast.error(msg);
    },
  });

  const createJobMutation = useMutation({
    mutationFn: async () => {
      const payload: CreateJobInput = {
        title: jobForm.title.trim(),
        description: jobForm.description.trim(),
        requirements: jobForm.requirements.trim(),
        location: jobForm.location.trim() || mrf?.location || undefined,
        status: jobForm.status,
        mrfId,
      };
      return taApi.createJob(payload);
    },
    onSuccess: () => {
      toast.success('Job posting created and linked to this MRF');
      queryClient.invalidateQueries({ queryKey: ['ta', 'mrf', mrfId] });
      queryClient.invalidateQueries({ queryKey: ['ta', 'jobs'] });
      setIsCreateJobModalOpen(false);
      setJobForm({
        title: '',
        description: '',
        requirements: '',
        location: '',
        status: JobStatus.OPEN,
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create job';
      toast.error(msg);
    },
  });

  const handleAddTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.documentLabel.trim()) {
      toast.error('Document label is required');
      return;
    }
    addTemplateMutation.mutate({
      documentLabel: templateForm.documentLabel.trim(),
      isRequired: templateForm.isRequired,
    });
  };

  const handleCreateJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobForm.title.trim() || !jobForm.description.trim() || !jobForm.requirements.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    createJobMutation.mutate();
  };

  if (isLoadingMRF) {
    return <LoadingState variant="detail" />;
  }

  if (isMRFError || !mrf) {
    return (
      <ErrorState
        title="Manpower Request Not Found"
        message={mrfError instanceof Error ? mrfError.message : 'The requested MRF could not be found.'}
        onRetry={refetchMRF}
      />
    );
  }

  const deployedCount = mrf._count?.deployments || 0;
  const headcount = mrf.headcount || 1;
  const fillPercent = Math.min(100, Math.round((deployedCount / headcount) * 100));
  const linkedJobs = mrf.jobPostings || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Back link */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/ta/mrfs"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to MRFs</span>
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={mrf.title}
        description={`MRF #${mrf.id} • Authorized for ${mrf.client?.name || 'Client'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/ta/dashboard' },
          { label: 'MRFs', href: '/ta/mrfs' },
          { label: `MRF #${mrf.id}` },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setJobForm({
                  title: mrf.title,
                  description: mrf.description || '',
                  requirements: mrf.requiredSkills || '',
                  location: mrf.location || '',
                  status: JobStatus.OPEN,
                });
                setIsCreateJobModalOpen(true);
              }}
              data-testid="create-job-for-mrf-btn"
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              <span>Create Job for this MRF</span>
            </button>
          </div>
        }
      />

      {/* Overview & Quota Progress Hero Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                  mrf.priority === 'URGENT'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                    : mrf.priority === 'HIGH'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                }`}
              >
                {mrf.priority} Priority
              </span>
              <span className="text-xs font-semibold text-muted-foreground">
                Status: <strong className="text-foreground uppercase">{mrf.status}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-foreground">
              <Building2 className="w-4 h-4 text-teal-600" />
              <Link to={`/ta/clients/${mrf.clientId}`} className="hover:underline text-teal-600">
                {mrf.client?.name || 'Client Account'}
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground sm:text-right">
            {mrf.targetFillDate && (
              <div>
                <span className="block font-medium">Target Fill Date</span>
                <span className="text-sm font-semibold text-foreground">
                  {new Date(mrf.targetFillDate).toLocaleDateString()}
                </span>
              </div>
            )}
            {mrf.location && (
              <div>
                <span className="block font-medium">Location</span>
                <span className="text-sm font-semibold text-foreground">{mrf.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Salary, Budget & Headcount Callout Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 rounded-xl p-4">
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
              Authorized Quota
            </span>
            <p className="text-lg font-bold font-mono text-teal-800 dark:text-teal-300 mt-1">
              {headcount} Positions
            </p>
          </div>
          <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 rounded-xl p-4">
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
              Active Deployments
            </span>
            <p className="text-lg font-bold font-mono text-teal-800 dark:text-teal-300 mt-1">
              {deployedCount} Placed
            </p>
          </div>
          <div className="bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 rounded-xl p-4">
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300 block uppercase tracking-wider">
              Fulfillment Velocity
            </span>
            <p className="text-lg font-bold font-mono text-teal-800 dark:text-teal-300 mt-1">
              {fillPercent}% Fulfilled
            </p>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="pt-2 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span>Headcount Quota Fulfillment</span>
            </span>
            <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm" data-testid="headcount-fill-ratio">
              {deployedCount} / {headcount} Filled ({fillPercent}%)
            </span>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-teal-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border flex items-center gap-6">
        <button
          onClick={() => setActiveTab('jobs')}
          data-testid="tab-mrf-jobs"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'jobs'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-4 h-4 text-teal-600" />
          <span>Linked Job Postings</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-bold">
            {linkedJobs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          data-testid="tab-mrf-compliance"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'compliance'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Compliance Templates</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
            {templates.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          data-testid="tab-mrf-specs"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'specs'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileCheck className="w-4 h-4 text-slate-500" />
          <span>Full Specifications</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          data-testid="tab-mrf-timeline"
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-teal-600 text-teal-700 dark:text-teal-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4 text-amber-600" />
          <span>Audit Trail</span>
        </button>
      </div>

      {/* Tab 1: Linked Job Postings */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Public & Internal Job Postings for MRF #{mrf.id}
              </h3>
              <p className="text-xs text-muted-foreground">
                Published job ads linked to recruit towards this headcount quota.
              </p>
            </div>
            <button
              onClick={() => {
                setJobForm({
                  title: mrf.title,
                  description: mrf.description || '',
                  requirements: mrf.requiredSkills || '',
                  location: mrf.location || '',
                  status: JobStatus.OPEN,
                });
                setIsCreateJobModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Linked Job</span>
            </button>
          </div>

          {linkedJobs.length === 0 ? (
            <EmptyState
              title="No job postings linked to this MRF"
              description="Create a job posting under this MRF to start receiving candidate applications."
              action={
                <button
                  onClick={() => setIsCreateJobModalOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  <span>Create Job Posting</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="mrf-jobs-list">
              {linkedJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-4 flex flex-col justify-between hover:border-teal-500/50 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <StatusBadge status={job.status} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <Link
                      to={`/ta/jobs/${job.id}`}
                      className="text-base font-bold text-foreground hover:text-teal-600 transition-colors block line-clamp-1"
                    >
                      {job.title}
                    </Link>

                    {job.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.location}</span>
                      </p>
                    )}

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{job.description}</p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-teal-600" />
                      <span>{job._count?.applications || 0} Applicants</span>
                    </span>

                    <Link
                      to={`/ta/jobs/${job.id}`}
                      className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Job & Ranking</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Compliance Document Templates */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Required Pre-Employment Compliance Templates
              </h3>
              <p className="text-xs text-muted-foreground">
                Document templates automatically required for candidates endorsed & hired for this MRF.
              </p>
            </div>
            <button
              onClick={() => setIsAddTemplateModalOpen(true)}
              data-testid="add-compliance-template-btn"
              className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Document Requirement</span>
            </button>
          </div>

          {isLoadingTemplates ? (
            <LoadingState variant="card" />
          ) : templates.length === 0 ? (
            <EmptyState
              title="No compliance templates configured"
              description="Define mandatory clearance certificates (NBI, Medical, Drug Test, SSS) for this role."
              action={
                <button
                  onClick={() => setIsAddTemplateModalOpen(true)}
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Requirement Template</span>
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" data-testid="compliance-templates-grid">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  data-testid={`compliance-template-${tpl.id}`}
                  className="bg-card border border-border rounded-xl p-5 shadow-subtle flex items-start justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                      <h4 className="text-sm font-bold text-foreground line-clamp-1">
                        {tpl.documentLabel}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {tpl.isRequired ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                          Optional
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Added: {new Date(tpl.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeTemplateMutation.mutate(tpl.id)}
                    disabled={removeTemplateMutation.isPending}
                    data-testid={`delete-template-${tpl.id}`}
                    aria-label={`Remove requirement ${tpl.documentLabel}`}
                    title="Remove template requirement"
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Full Specifications */}
      {activeTab === 'specs' && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-6 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-foreground">MRF Position Specifications</h3>
            <p className="text-xs text-muted-foreground">Comprehensive role criteria and parameters.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <span className="text-xs font-medium text-muted-foreground block">MRF Number</span>
              <p className="font-semibold text-foreground font-mono mt-1">#{mrf.id}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Client Account</span>
              <p className="font-semibold text-foreground mt-1">{mrf.client?.name || 'N/A'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Headcount Quota</span>
              <p className="font-semibold text-foreground mt-1">{mrf.headcount} Personnel</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Priority Level</span>
              <p className="font-semibold text-foreground mt-1 uppercase">{mrf.priority}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Deployment Location</span>
              <p className="font-semibold text-foreground mt-1">{mrf.location || 'Unspecified'}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground block">Target Fill Date</span>
              <p className="font-semibold text-foreground mt-1">
                {mrf.targetFillDate ? new Date(mrf.targetFillDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>

          {/* Dedicated Salary / Budget Callout block in Specs */}
          <div className="p-4 bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-teal-800 dark:text-teal-300 uppercase tracking-wider block">
              Authorized Manpower Compensation & Budget
            </span>
            <p className="text-lg font-bold font-mono text-teal-800 dark:text-teal-300">
              Standard Client Master Service Rate • {mrf.headcount} Authorized Billable Seats
            </p>
            <p className="text-xs text-teal-700/80 dark:text-teal-300/80">
              Budget allocation strictly linked to client billing terms and compliance clearances.
            </p>
          </div>

          {mrf.requiredSkills && (
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Required Skills</span>
              <p className="font-medium text-foreground mt-1.5 bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg text-sm">
                {mrf.requiredSkills}
              </p>
            </div>
          )}

          {mrf.description && (
            <div>
              <span className="text-xs font-medium text-muted-foreground block">Description / Notes</span>
              <div className="font-medium text-foreground mt-1.5 bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-lg text-sm leading-relaxed whitespace-pre-line">
                {mrf.description}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Audit Trail & Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-subtle space-y-5 max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-foreground">MRF Audit Trail & Event Timeline</h3>
            <p className="text-xs text-muted-foreground">
              Chronological log of authorizations, modifications, and headcount status.
            </p>
          </div>

          <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-background">
            <div className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                <div>
                  <span className="text-sm font-semibold text-foreground">MRF Created & Staffing Authorized</span>
                  <p className="text-xs text-muted-foreground">
                    Initial quota of {mrf.headcount} slots authorized for {mrf.client?.name || 'Client'}.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground sm:text-right">
                <span className="text-sm font-semibold text-foreground">System Admin</span>
                <span className="font-mono text-xs text-muted-foreground">{new Date(mrf.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {mrf.updatedAt && (
              <div className="py-3 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-foreground">Quota & Pipeline Synchronized</span>
                    <p className="text-xs text-muted-foreground">
                      Recruitment pipeline active with {deployedCount} candidate placements.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground sm:text-right">
                  <span className="text-sm font-semibold text-foreground">TA Recruiter</span>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(mrf.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Compliance Template Modal */}
      {isAddTemplateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-template-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="add-template-modal-title" className="text-base font-semibold text-foreground">
                    Add Compliance Requirement
                  </h3>
                  <p className="text-xs text-muted-foreground">MRF #{mrf.id} document checklist template.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTemplateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Document Label / Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="template-label-input"
                  value={templateForm.documentLabel}
                  onChange={(e) => setTemplateForm({ ...templateForm, documentLabel: e.target.value })}
                  placeholder="e.g. NBI Clearance, Medical Certificate, SSS E1"
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="isRequiredCheckbox"
                  data-testid="template-required-checkbox"
                  checked={templateForm.isRequired}
                  onChange={(e) => setTemplateForm({ ...templateForm, isRequired: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <label htmlFor="isRequiredCheckbox" className="text-sm font-medium text-foreground cursor-pointer">
                  Mandatory for Onboarding / Deployment
                </label>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddTemplateModalOpen(false)}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-add-template-btn"
                  disabled={addTemplateMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {addTemplateMutation.isPending ? 'Saving...' : 'Add Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Job for MRF Modal */}
      {isCreateJobModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-job-mrf-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 rounded-lg">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="create-job-mrf-modal-title" className="text-base font-semibold text-foreground">
                    Create Job Posting for MRF #{mrf.id}
                  </h3>
                  <p className="text-xs text-muted-foreground">Publish a job opportunity linked to this quota.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateJobModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateJobSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  data-testid="mrf-job-title-input"
                  value={jobForm.title}
                  onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                  className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Location</label>
                  <input
                    type="text"
                    data-testid="mrf-job-location-input"
                    value={jobForm.location}
                    onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Status</label>
                  <select
                    data-testid="mrf-job-status-select"
                    value={jobForm.status}
                    onChange={(e) => setJobForm({ ...jobForm, status: e.target.value as JobStatus })}
                    className="w-full h-10 px-3.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                  >
                    <option value={JobStatus.OPEN}>Open (Published)</option>
                    <option value={JobStatus.DRAFT}>Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Job Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  data-testid="mrf-job-description-input"
                  value={jobForm.description}
                  onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Qualifications & Requirements <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  data-testid="mrf-job-requirements-input"
                  value={jobForm.requirements}
                  onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-y"
                />
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateJobModalOpen(false)}
                  className="h-10 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-border transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-create-mrf-job-btn"
                  disabled={createJobMutation.isPending}
                  className="inline-flex items-center gap-2 h-10 px-5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {createJobMutation.isPending ? 'Creating...' : 'Create Job Posting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
