import { apiClient } from './client';
import type {
  Client,
  ManpowerRequest,
  MRFComplianceTemplate,
  JobPosting,
  ApplicationListItem,
  ApplicationDetail,
  Interview,
  ClientEndorsement,
  ComplianceRequirement,
  Deployment,
  RecruiterDecision,
  TalentPoolMembership,
  TalentPoolContact,
  TalentPoolSearchResult,
  PipelineStats,
  TimeToFillStats,
  DeploymentStats,
  ComplianceOverviewStats,
  CreateClientInput,
  CreateMRFInput,
  CreateJobInput,
  UpdateJobInput,
  CreateComplianceTemplateInput,
  ScheduleInterviewInput,
  UpdateInterviewStatusInput,
  RecordEndorsementInput,
  CreateRequirementInput,
  ReviewRequirementInput,
  CreateDeploymentInput,
  UpdateDeploymentStatusInput,
  ApiResponse,
  JobStatus,
  ApplicationStatus,
} from '../types/api';

export const taApi = {
  // ── Clients ───────────────────────────────
  listClients: async (params?: { search?: string; status?: string }): Promise<ApiResponse<Client[]>> => {
    return apiClient.get<Client[]>('/api/ta/clients', params);
  },

  getClient: async (id: number): Promise<ApiResponse<Client>> => {
    return apiClient.get<Client>(`/api/ta/clients/${id}`);
  },

  createClient: async (data: CreateClientInput): Promise<ApiResponse<Client>> => {
    return apiClient.post<Client>('/api/ta/clients', data);
  },

  updateClient: async (id: number, data: Partial<CreateClientInput>): Promise<ApiResponse<Client>> => {
    return apiClient.patch<Client>(`/api/ta/clients/${id}`, data);
  },

  // ── MRFs ──────────────────────────────────
  listMRFs: async (params?: { clientId?: number; status?: string }): Promise<ApiResponse<ManpowerRequest[]>> => {
    return apiClient.get<ManpowerRequest[]>('/api/ta/mrfs', params);
  },

  getMRF: async (id: number): Promise<ApiResponse<ManpowerRequest>> => {
    return apiClient.get<ManpowerRequest>(`/api/ta/mrfs/${id}`);
  },

  createMRF: async (data: CreateMRFInput): Promise<ApiResponse<ManpowerRequest>> => {
    return apiClient.post<ManpowerRequest>('/api/ta/mrfs', data);
  },

  updateMRF: async (id: number, data: Partial<CreateMRFInput>): Promise<ApiResponse<ManpowerRequest>> => {
    return apiClient.patch<ManpowerRequest>(`/api/ta/mrfs/${id}`, data);
  },

  linkJobToMRF: async (mrfId: number, jobPostingId: number): Promise<ApiResponse<JobPosting>> => {
    return apiClient.post<JobPosting>(`/api/ta/mrfs/${mrfId}/link-job`, { jobPostingId });
  },

  addMRFComplianceTemplate: async (
    mrfId: number,
    data: CreateComplianceTemplateInput
  ): Promise<ApiResponse<MRFComplianceTemplate>> => {
    return apiClient.post<MRFComplianceTemplate>(`/api/ta/mrfs/${mrfId}/compliance-templates`, data);
  },

  createComplianceTemplate: async (
    mrfId: number,
    data: CreateComplianceTemplateInput
  ): Promise<ApiResponse<MRFComplianceTemplate>> => {
    return apiClient.post<MRFComplianceTemplate>(`/api/ta/mrfs/${mrfId}/compliance-templates`, data);
  },

  listMRFComplianceTemplates: async (mrfId: number): Promise<ApiResponse<MRFComplianceTemplate[]>> => {
    return apiClient.get<MRFComplianceTemplate[]>(`/api/ta/mrfs/${mrfId}/compliance-templates`);
  },

  removeMRFComplianceTemplate: async (templateId: number): Promise<ApiResponse<null>> => {
    return apiClient.delete<null>(`/api/ta/mrfs/compliance-templates/${templateId}`);
  },

  // ── Jobs ──────────────────────────────────
  listJobs: async (params?: { status?: JobStatus; search?: string }): Promise<ApiResponse<JobPosting[]>> => {
    return apiClient.get<JobPosting[]>('/api/ta/jobs', params);
  },

  getJob: async (id: number): Promise<ApiResponse<JobPosting>> => {
    return apiClient.get<JobPosting>(`/api/ta/jobs/${id}`);
  },

  createJob: async (data: CreateJobInput): Promise<ApiResponse<JobPosting>> => {
    return apiClient.post<JobPosting>('/api/ta/jobs', data);
  },

  updateJob: async (id: number, data: UpdateJobInput): Promise<ApiResponse<JobPosting>> => {
    return apiClient.patch<JobPosting>(`/api/ta/jobs/${id}`, data);
  },

  updateJobStatus: async (id: number, status: JobStatus): Promise<ApiResponse<JobPosting>> => {
    return apiClient.patch<JobPosting>(`/api/ta/jobs/${id}/status`, { status });
  },

  rankCandidates: async (jobId: number): Promise<ApiResponse<{ reevaluatedCount: number }>> => {
    return apiClient.post(`/api/ta/jobs/${jobId}/rank-candidates`);
  },

  getRankedCandidates: async (jobId: number): Promise<ApiResponse<ApplicationListItem[]>> => {
    return apiClient.get<ApplicationListItem[]>(`/api/ta/jobs/${jobId}/ranked-candidates`);
  },

  getJobTalentPool: async (jobId: number): Promise<ApiResponse<TalentPoolMembership[]>> => {
    return apiClient.get<TalentPoolMembership[]>(`/api/ta/jobs/${jobId}/talent-pool`);
  },

  getSimilarCandidates: async (candidateId: number): Promise<ApiResponse<TalentPoolSearchResult[]>> => {
    return apiClient.get<TalentPoolSearchResult[]>(`/api/ta/candidates/${candidateId}/similar`);
  },

  listApplications: async (params?: {
    status?: ApplicationStatus;
    jobPostingId?: number;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<ApplicationListItem[]>> => {
    return apiClient.get<ApplicationListItem[]>('/api/ta/applications', params);
  },

  getApplication: async (id: number): Promise<ApiResponse<ApplicationDetail>> => {
    return apiClient.get<ApplicationDetail>(`/api/ta/applications/${id}`);
  },

  updateApplicationStatus: async (
    id: number,
    status: ApplicationStatus,
    reason?: string
  ): Promise<ApiResponse<{ id: number; status: ApplicationStatus; updatedAt: string }>> => {
    return apiClient.patch(`/api/ta/applications/${id}/status`, { status, reason });
  },

  archiveApplication: async (id: number, reason?: string): Promise<ApiResponse<null>> => {
    return apiClient.patch(`/api/ta/applications/${id}/archive`, { reason });
  },

  restoreApplication: async (id: number, reason?: string): Promise<ApiResponse<null>> => {
    return apiClient.patch(`/api/ta/applications/${id}/restore`, { reason });
  },

  getRecruiterDecisions: async (id: number): Promise<ApiResponse<RecruiterDecision[]>> => {
    return apiClient.get<RecruiterDecision[]>(`/api/ta/applications/${id}/decisions`);
  },

  analyzeApplication: async (id: number): Promise<ApiResponse<{ aiScore: number; aiSummary: string }>> => {
    return apiClient.post(`/api/ta/applications/${id}/analyze`);
  },

  // ── Interviews ────────────────────────────
  listInterviews: async (applicationId: number): Promise<ApiResponse<Interview[]>> => {
    return apiClient.get<Interview[]>(`/api/ta/applications/${applicationId}/interviews`);
  },

  scheduleInterview: async (applicationId: number, data: ScheduleInterviewInput): Promise<ApiResponse<Interview>> => {
    return apiClient.post<Interview>(`/api/ta/applications/${applicationId}/interviews`, data);
  },

  updateInterviewStatus: async (
    applicationId: number,
    interviewId: number,
    data: UpdateInterviewStatusInput
  ): Promise<ApiResponse<Interview>> => {
    return apiClient.patch<Interview>(
      `/api/ta/applications/${applicationId}/interviews/${interviewId}/status`,
      data
    );
  },

  checkInterviewCompliance: async (): Promise<ApiResponse<{ compliant: boolean; pendingSla: number }>> => {
    return apiClient.get('/api/ta/compliance/interviews');
  },

  // ── Client Endorsement ────────────────────
  recordEndorsement: async (applicationId: number, data: RecordEndorsementInput): Promise<ApiResponse<ClientEndorsement>> => {
    return apiClient.post<ClientEndorsement>(`/api/ta/applications/${applicationId}/endorse`, data);
  },

  listEndorsements: async (applicationId: number): Promise<ApiResponse<ClientEndorsement[]>> => {
    return apiClient.get<ClientEndorsement[]>(`/api/ta/applications/${applicationId}/endorsements`);
  },

  // ── Compliance Checklist ──────────────────
  createRequirement: async (
    applicationId: number,
    data: CreateRequirementInput
  ): Promise<ApiResponse<ComplianceRequirement>> => {
    return apiClient.post<ComplianceRequirement>(`/api/ta/applications/${applicationId}/compliance`, data);
  },

  listRequirements: async (applicationId: number): Promise<ApiResponse<ComplianceRequirement[]>> => {
    return apiClient.get<ComplianceRequirement[]>(`/api/ta/applications/${applicationId}/compliance`);
  },

  submitDocument: async (requirementId: number, file: File): Promise<ApiResponse<ComplianceRequirement>> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.upload<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/submit`, formData);
  },

  reviewRequirement: async (
    requirementId: number,
    data: ReviewRequirementInput
  ): Promise<ApiResponse<ComplianceRequirement>> => {
    return apiClient.patch<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/review`, data);
  },

  // ── Deployments ───────────────────────────
  createDeployment: async (applicationId: number, data: CreateDeploymentInput): Promise<ApiResponse<Deployment>> => {
    return apiClient.post<Deployment>(`/api/ta/applications/${applicationId}/deploy`, data);
  },

  updateDeploymentStatus: async (
    id: number,
    data: UpdateDeploymentStatusInput
  ): Promise<ApiResponse<Deployment>> => {
    return apiClient.patch<Deployment>(`/api/ta/deployments/${id}/status`, data);
  },

  listDeployments: async (params?: { clientId?: number; status?: string }): Promise<ApiResponse<Deployment[]>> => {
    return apiClient.get<Deployment[]>('/api/ta/deployments', params);
  },

  getDeployment: async (id: number): Promise<ApiResponse<Deployment>> => {
    return apiClient.get<Deployment>(`/api/ta/deployments/${id}`);
  },

  // ── Talent Pool ───────────────────────────
  searchTalentPool: async (query: {
    query: string;
    k?: number;
    availability?: string;
  }): Promise<ApiResponse<TalentPoolSearchResult[]>> => {
    return apiClient.post<TalentPoolSearchResult[]>('/api/ta/talent-pool/search', query);
  },

  addToPool: async (data: {
    applicantProfileId: number;
    sourceApplicationId?: number;
    notes?: string;
  }): Promise<ApiResponse<TalentPoolMembership>> => {
    return apiClient.post<TalentPoolMembership>('/api/ta/talent-pool/members', data);
  },

  recordContact: async (data: {
    membershipId: number;
    jobPostingId: number;
    outcome: string;
    notes?: string;
  }): Promise<ApiResponse<TalentPoolContact>> => {
    return apiClient.post<TalentPoolContact>('/api/ta/talent-pool/contacts', data);
  },

  contactTalentPoolMember: async (data: {
    membershipId: number;
    jobPostingId: number;
    outcome: string;
    notes?: string;
  }): Promise<ApiResponse<TalentPoolContact>> => {
    return apiClient.post<TalentPoolContact>('/api/ta/talent-pool/contacts', data);
  },

  matchTalentPoolForJob: async (jobId: number): Promise<ApiResponse<TalentPoolMembership[]>> => {
    return apiClient.get<TalentPoolMembership[]>(`/api/ta/jobs/${jobId}/talent-pool`);
  },

  considerCandidate: async (data: {
    membershipId: number;
    jobPostingId: number;
  }): Promise<ApiResponse<{ application: ApplicationListItem }>> => {
    return apiClient.post('/api/ta/talent-pool/consider', data);
  },

  // ── Post-Hire / Onboarding ────────────────
  startOnboarding: async (applicationId: number): Promise<ApiResponse<null>> => {
    return apiClient.patch<null>(`/api/ta/applications/${applicationId}/onboard`);
  },

  uploadPostHireDocument: async (
    applicationId: number,
    label: string,
    file: File
  ): Promise<ApiResponse<{ id: number; label: string; fileUrl: string }>> => {
    const formData = new FormData();
    formData.append('label', label);
    formData.append('file', file);
    return apiClient.upload(`/api/ta/applications/${applicationId}/documents`, formData);
  },

  completeHiring: async (
    applicationId: number,
    data: { employeeNumber?: string; department?: string; position?: string; hireDate?: string }
  ): Promise<ApiResponse<{ employeeId: number }>> => {
    return apiClient.post(`/api/ta/applications/${applicationId}/hire`, data);
  },

  // ── Analytics ─────────────────────────────
  getPipelineStats: async (): Promise<ApiResponse<PipelineStats>> => {
    return apiClient.get<PipelineStats>('/api/ta/analytics/pipeline');
  },

  getTimeToFillStats: async (): Promise<ApiResponse<TimeToFillStats>> => {
    return apiClient.get<TimeToFillStats>('/api/ta/analytics/time-to-fill');
  },

  getDeploymentStats: async (): Promise<ApiResponse<DeploymentStats>> => {
    return apiClient.get<DeploymentStats>('/api/ta/analytics/deployments');
  },

  getComplianceOverview: async (): Promise<ApiResponse<ComplianceOverviewStats>> => {
    return apiClient.get<ComplianceOverviewStats>('/api/ta/analytics/compliance');
  },

  exportPipelineReport: async (format: 'pdf' | 'xlsx'): Promise<Blob> => {
    const response = await fetch(`/api/ta/reports/pipeline?format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('megs_access_token') || ''}`,
      },
    });
    return response.blob();
  },

  exportDeploymentReport: async (format: 'pdf' | 'xlsx'): Promise<Blob> => {
    const response = await fetch(`/api/ta/reports/deployments?format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('megs_access_token') || ''}`,
      },
    });
    return response.blob();
  },
};
