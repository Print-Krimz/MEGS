import { api } from "./client";
import type {
  Application,
  TAApplicationSummary,
  JobPosting,
  Interview,
  CandidateScore,
  ClientEndorsement,
  ComplianceRequirement,
  RecruiterDecision,
} from "../types/application.types";
import type {
  ManpowerRequest,
  CreateMRFDto,
  UpdateMRFDto,
  MRFComplianceTemplate,
  CreateJobDto,
  UpdateJobDto,
  ScheduleInterviewDto,
  UpdateInterviewResultDto,
  EndorseCandidateDto,
  AddComplianceRequirementDto,
  ReviewComplianceDto,
  DeployCandidateDto,
  UpdateDeploymentStatusDto,
  TalentPoolMembership,
  TalentPoolSearchDto,
  TalentPoolMatchResult,
  SendTalentPoolInvitationDto,
  BatchSendTalentPoolInvitationsDto,
  TalentPoolInvitationRecord,
  PipelineAnalytics,
  ComplianceAnalytics,
  InterviewSLASummary,
  UpdateCandidateProfileDto,
} from "../types/ta.types";
import type { ApplicantProfile } from "../types/applicant.types";
import type { Client, CreateClientDto, UpdateClientDto } from "../types/client.types";
import type { Deployment } from "../types/employee.types";
import type { ApplicationStatus } from "../types/enums";
import type { PaginatedListResponse } from "../types/api.types";
import type {
  TADeliveryDashboard,
  TAPendingActionItem,
  AnalyticsFilterOptions,
  AnalyticsFilterState,
} from "../types/analytics.types";

function buildTAAnalyticsQueryString(filters?: Partial<AnalyticsFilterState>): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.range) params.append("range", filters.range);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.clientId) params.append("clientId", String(filters.clientId));
  if (filters.mrfId) params.append("mrfId", String(filters.mrfId));
  if (filters.jobPostingId) params.append("jobPostingId", String(filters.jobPostingId));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApplicationQueryFilters {
  status?: ApplicationStatus;
  jobId?: number | string;
  clientId?: number | string;
  search?: string;
  isArchived?: boolean;
  returning?: boolean;
  page?: number;
  limit?: number;
  summary?: boolean;
}

export interface TAJobDetail extends JobPosting {
  applications?: Array<{
    id: number;
    status: ApplicationStatus;
    isArchived: boolean;
    user?: { id: string; email: string };
  }>;
}

export interface TADashboardCounts {
  openJobs: number;
  activeDeployments: number;
}

export const taApi = {
  getDashboardCounts: (options?: RequestInit) =>
    api.get<TADashboardCounts>("/api/ta/dashboard-counts", options),

  // -------------------------------------------------------------
  // 1. Applications Pipeline & Recruiter Decisions
  // -------------------------------------------------------------
  listApplications: (filters?: ApplicationQueryFilters, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.jobId) params.append("jobId", String(filters.jobId));
    if (filters?.clientId) params.append("clientId", String(filters.clientId));
    const search = filters?.search?.trim();
    if (search) params.append("search", search);
    if (filters?.isArchived !== undefined) params.append("isArchived", String(filters.isArchived));
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));
    if (filters?.summary) params.append("summary", "true");

    const qs = params.toString();
    return api.get<PaginatedResult<Application> | Application[]>(
      `/api/ta/applications${qs ? `?${qs}` : ""}`,
      options,
    );
  },

  listApplicationsPage: (filters: ApplicationQueryFilters & { page: number; limit: number }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.jobId) params.append("jobId", String(filters.jobId));
    if (filters.clientId) params.append("clientId", String(filters.clientId));
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.isArchived !== undefined) params.append("isArchived", String(filters.isArchived));
    if (filters.returning) params.append("returning", "true");
    params.append("page", String(filters.page));
    params.append("limit", String(filters.limit));
    params.append("summary", "true");
    return api.get<PaginatedListResponse<TAApplicationSummary>>(
      `/api/ta/applications?${params.toString()}`,
      options,
    );
  },

  getApplication: (id: number | string) =>
    api.get<Application>(`/api/ta/applications/${id}`),

  updateApplicationStatus: (
    id: number | string,
    data: { status: ApplicationStatus; reason?: string; reasonCode?: string }
  ) => api.patch<Application>(`/api/ta/applications/${id}/status`, data),

  recordBackout: (
    id: number | string,
    data: { party: string; reason: string; notes?: string; occurredOn?: string }
  ) => api.post<unknown>(`/api/ta/applications/${id}/backout`, data),

  archiveApplication: (id: number | string, data: { reason: string }) =>
    api.patch<Application>(`/api/ta/applications/${id}/archive`, data),

  restoreApplication: (id: number | string, data: { reason: string }) =>
    api.patch<Application>(`/api/ta/applications/${id}/restore`, data),

  getRecruiterDecisions: (id: number | string) =>
    api.get<RecruiterDecision[]>(`/api/ta/applications/${id}/decisions`),

  downloadContractPdf: (id: number | string, startDate: string) =>
    api.blob(`/api/ta/applications/${id}/contract/pdf?startDate=${encodeURIComponent(startDate)}`),

  uploadSignedContract: (id: number | string, formData: FormData) =>
    api.upload<Application>(`/api/ta/applications/${id}/contract/signed`, formData),

  updateCandidateProfile: (id: number | string, data: UpdateCandidateProfileDto) =>
    api.patch<ApplicantProfile>(`/api/ta/candidates/${id}`, data),

  // -------------------------------------------------------------
  // 2. AI Scoring & Assessment
  // -------------------------------------------------------------
  analyzeApplication: (id: number | string) =>
    api.post<{ success: boolean; score?: number; summary?: string }>(
      `/api/ta/applications/${id}/analyze`,
      {}
    ),

  // -------------------------------------------------------------
  // 3. Job Postings & Candidate Match Ranking
  // -------------------------------------------------------------
  listJobs: (filters?: { status?: string; search?: string; clientId?: number | string }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    const search = filters?.search?.trim();
    if (search) params.append("search", search);
    if (filters?.clientId) params.append("clientId", String(filters.clientId));
    const qs = params.toString();
    return api.get<JobPosting[]>(
      `/api/ta/jobs${qs ? `?${qs}` : ""}`,
      options,
    );
  },

  listJobsPage: (filters: {
    status?: string;
    search?: string;
    clientId?: number | string;
    page: number;
    limit: number;
  }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.clientId) params.append("clientId", String(filters.clientId));
    params.append("page", String(filters.page));
    params.append("limit", String(filters.limit));
    return api.get<PaginatedListResponse<JobPosting>>(
      `/api/ta/jobs?${params.toString()}`,
      options,
    );
  },

  createJob: (data: CreateJobDto) =>
    api.post<JobPosting>("/api/ta/jobs", data),

  getJob: (id: number | string, options?: RequestInit) =>
    api.get<TAJobDetail>(`/api/ta/jobs/${id}`, options),

  updateJob: (id: number | string, data: UpdateJobDto) =>
    api.patch<JobPosting>(`/api/ta/jobs/${id}`, data),

  updateJobStatus: (id: number | string, status: string) =>
    api.patch<JobPosting>(`/api/ta/jobs/${id}/status`, { status }),

  rankCandidates: (jobId: number | string) =>
    api.post<{ rankedCount: number }>(`/api/ta/jobs/${jobId}/rank-candidates`, {}),

  getRankedCandidates: async (jobId: number | string, options?: RequestInit) => {
    const res = await api.get<{ items: CandidateScore[] } | CandidateScore[]>(
      `/api/ta/jobs/${jobId}/ranked-candidates`,
      options,
    );
    if (res && typeof res === "object" && "items" in res && Array.isArray((res as any).items)) {
      return (res as any).items as CandidateScore[];
    }
    return (Array.isArray(res) ? res : []) as CandidateScore[];
  },

  getJobTalentPool: async (jobId: number | string, options?: RequestInit) => {
    const res = await api.get<{ items: TalentPoolMatchResult[] } | TalentPoolMatchResult[]>(
      `/api/ta/jobs/${jobId}/talent-pool`,
      options,
    );
    if (res && typeof res === "object" && "items" in res && Array.isArray((res as any).items)) {
      return (res as any).items as TalentPoolMatchResult[];
    }
    return (Array.isArray(res) ? res : []) as TalentPoolMatchResult[];
  },

  getSimilarCandidates: async (candidateId: number | string) => {
    const res = await api.get<{ items: TalentPoolMatchResult[] } | TalentPoolMatchResult[]>(
      `/api/ta/candidates/${candidateId}/similar`
    );
    if (res && typeof res === "object" && "items" in res && Array.isArray((res as any).items)) {
      return (res as any).items as TalentPoolMatchResult[];
    }
    return (Array.isArray(res) ? res : []) as TalentPoolMatchResult[];
  },

  // -------------------------------------------------------------
  // 4. Talent Pool (KNN Matching & Reactivation)
  // -------------------------------------------------------------
  searchTalentPool: async (data: TalentPoolSearchDto) => {
    const res = await api.post<{ items: TalentPoolMatchResult[] } | TalentPoolMatchResult[]>(
      "/api/ta/talent-pool/search",
      data
    );
    if (res && typeof res === "object" && "items" in res && Array.isArray((res as any).items)) {
      return (res as any).items as TalentPoolMatchResult[];
    }
    return (Array.isArray(res) ? res : []) as TalentPoolMatchResult[];
  },

  addCandidateToPool: (data: { applicantProfileId: number; sourceApplicationId?: number; notes?: string }) =>
    api.post<TalentPoolMembership>("/api/ta/talent-pool/members", data),

  recordContact: (data: {
    membershipId: number;
    jobPostingId: number;
    outcome: string;
    notes?: string;
  }) => api.post<{ id: number; membershipId: number; jobPostingId: number; outcome: string }>("/api/ta/talent-pool/contacts", data),

  considerCandidateForJob: (data: {
    applicantProfileId: number;
    targetJobId: number;
    notes?: string;
    contactOutcome?: "INTERESTED" | "NOT_INTERESTED" | "NO_RESPONSE" | "UNAVAILABLE";
  }) =>
    api.post<{
      success: boolean;
      message: string;
      application: Application;
      contact: { id: number; membershipId: number; jobPostingId: number; outcome: string };
      score?: CandidateScore | null;
    }>("/api/ta/talent-pool/consider", data),

  sendTalentPoolInvitation: (data: SendTalentPoolInvitationDto) =>
    api.post<TalentPoolInvitationRecord>("/api/ta/talent-pool/invitations", data),

  batchSendTalentPoolInvitations: (data: BatchSendTalentPoolInvitationsDto) =>
    api.post<{ sentCount: number; failedCount: number; results: any[] }>("/api/ta/talent-pool/invitations/batch", data),

  listTalentPoolInvitations: (params?: { status?: string; jobPostingId?: number; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.append("status", params.status);
    if (params?.jobPostingId) qs.append("jobPostingId", String(params.jobPostingId));
    if (params?.page) qs.append("page", String(params.page));
    if (params?.limit) qs.append("limit", String(params.limit));
    const qStr = qs.toString();
    return api.get<{
      items: TalentPoolInvitationRecord[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/ta/talent-pool/invitations${qStr ? `?${qStr}` : ""}`);
  },

  cancelTalentPoolInvitation: (id: number) =>
    api.delete<{ id: number; status: string }>(`/api/ta/talent-pool/invitations/${id}`),

  // -------------------------------------------------------------
  // 5. Clients & MRFs (Manpower Requests)
  // -------------------------------------------------------------
  listClients: (options?: RequestInit) =>
    api.get<Client[]>("/api/ta/clients", options),

  createClient: (data: CreateClientDto) =>
    api.post<Client>("/api/ta/clients", data),

  getClientDetails: (id: number | string) =>
    api.get<Client>(`/api/ta/clients/${id}`),

  updateClient: (id: number | string, data: UpdateClientDto) =>
    api.patch<Client>(`/api/ta/clients/${id}`, data),

  listMRFs: (filters?: {
    clientId?: number | string;
    status?: string;
    priority?: string;
    sortBy?: string;
  }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters?.clientId) params.append("clientId", String(filters.clientId));
    if (filters?.status) params.append("status", filters.status);
    if (filters?.priority) params.append("priority", filters.priority);
    if (filters?.sortBy) params.append("sortBy", filters.sortBy);
    const qs = params.toString();
    return api.get<ManpowerRequest[]>(`/api/ta/mrfs${qs ? `?${qs}` : ""}`, options);
  },

  createMRF: (data: CreateMRFDto) =>
    api.post<ManpowerRequest>("/api/ta/mrfs", data),

  getMRFDetails: (id: number | string) =>
    api.get<ManpowerRequest>(`/api/ta/mrfs/${id}`),

  updateMRF: (id: number | string, data: UpdateMRFDto) =>
    api.patch<ManpowerRequest>(`/api/ta/mrfs/${id}`, data),

  linkJobToMRF: (mrfId: number | string, jobId: number | string) =>
    api.post(`/api/ta/mrfs/${mrfId}/link-job`, {
      jobPostingId: Number(jobId),
      jobId: Number(jobId),
    }),

  addMRFComplianceTemplate: (
    mrfId: number | string,
    data: { documentLabel: string; isRequired?: boolean }
  ) => api.post<MRFComplianceTemplate>(`/api/ta/mrfs/${mrfId}/compliance-templates`, data),

  addMRFComplianceTemplatesBulk: (
    mrfId: number | string,
    data: { documentLabels: string[]; isRequired?: boolean }
  ) =>
    api.post<{ count: number; added: string[] }>(
      `/api/ta/mrfs/${mrfId}/compliance-templates/bulk`,
      data
    ),

  listMRFComplianceTemplates: (mrfId: number | string) =>
    api.get<MRFComplianceTemplate[]>(`/api/ta/mrfs/${mrfId}/compliance-templates`),

  removeMRFComplianceTemplate: (templateId: number | string) =>
    api.delete<null>(`/api/ta/mrfs/compliance-templates/${templateId}`),

  // -------------------------------------------------------------
  // 6. Client Endorsements
  // -------------------------------------------------------------
  recordEndorsement: (applicationId: number | string, data: EndorseCandidateDto) =>
    api.post<ClientEndorsement>(`/api/ta/applications/${applicationId}/endorse`, data),

  updateEndorsement: (
    applicationId: number | string,
    endorsementId: number | string,
    data: { outcome: "PENDING" | "APPROVED" | "DECLINED" | "ENDORSED"; notes?: string }
  ) =>
    api.patch<ClientEndorsement>(
      `/api/ta/applications/${applicationId}/endorsements/${endorsementId}`,
      data
    ),

  listEndorsements: (applicationId: number | string) =>
    api.get<ClientEndorsement[]>(`/api/ta/applications/${applicationId}/endorsements`),

  // -------------------------------------------------------------
  // 7. Interviews & Compliance SLA
  // -------------------------------------------------------------
  listInterviews: (applicationId: number | string) =>
    api.get<Interview[]>(`/api/ta/applications/${applicationId}/interviews`),

  scheduleInterview: (applicationId: number | string, data: ScheduleInterviewDto) =>
    api.post<Interview>(`/api/ta/applications/${applicationId}/interviews`, data),

  updateInterviewStatus: (
    applicationId: number | string,
    interviewId: number | string,
    data: UpdateInterviewResultDto
  ) => api.patch<Interview>(`/api/ta/applications/${applicationId}/interviews/${interviewId}/status`, data),

  recordInterviewDirectly: (
    applicationId: number | string,
    data: { type: string; result: string; conductedAt?: string | null; notes?: string }
  ) => api.post<Interview>(`/api/ta/applications/${applicationId}/interviews/record`, data),

  checkInterviewCompliance: () =>
    api.get<InterviewSLASummary>("/api/ta/compliance/interviews"),

  // -------------------------------------------------------------
  // 8. 201 Compliance Tracking
  // -------------------------------------------------------------
  getComplianceQueue: (scope: "PRE_DEPLOYMENT" | "POST_DEPLOYMENT" | "ALL" = "ALL") =>
    api.get<Application[]>(`/api/ta/compliance/queue?scope=${scope}`),

  createComplianceRequirement: (
    applicationId: number | string,
    data: AddComplianceRequirementDto
  ) => api.post<ComplianceRequirement>(`/api/ta/applications/${applicationId}/compliance`, data),

  listComplianceRequirements: (applicationId: number | string) =>
    api.get<ComplianceRequirement[]>(`/api/ta/applications/${applicationId}/compliance`),

  submitComplianceDocument: (requirementId: number | string, formData: FormData) =>
    api.upload<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/submit`, formData),

  reviewComplianceRequirement: (requirementId: number | string, data: ReviewComplianceDto) =>
    api.patch<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/review`, data),

  requestDocumentUpdate: (requirementId: number, data: { reason: string; deadline: string }) =>
    api.post<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/update-request`, data),

  updateComplianceRequirementDeadline: (requirementId: number | string, deadline: string | null) =>
    api.patch<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/deadline`, { deadline }),

  deleteComplianceRequirement: (requirementId: number | string) =>
    api.delete<{ id: number; success: boolean }>(`/api/ta/compliance/${requirementId}`),

  // -------------------------------------------------------------
  // 9. Deployment Lifecycle
  // -------------------------------------------------------------
  createDeployment: (applicationId: number | string, data: DeployCandidateDto) =>
    api.post<Deployment>(`/api/ta/applications/${applicationId}/deploy`, data),

  fastTrackRedeployment: (
    applicationId: number | string,
    data?: { targetStage?: "FINAL_INTERVIEW" | "COMPLIANCE" }
  ) =>
    api.post<{
      success: boolean;
      application: Application;
      carriedOverDocuments: any[];
    }>(`/api/ta/applications/${applicationId}/fast-track-redeployment`, data || {}),

  updateDeploymentStatus: (id: number | string, data: UpdateDeploymentStatusDto) =>
    api.patch<Deployment>(`/api/ta/deployments/${id}/status`, data),

  listDeployments: (filters?: { status?: string; clientId?: number | string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.clientId) params.append("clientId", String(filters.clientId));
    const qs = params.toString();
    return api.get<Deployment[]>(`/api/ta/deployments${qs ? `?${qs}` : ""}`);
  },

  getDeploymentDetails: (id: number | string) =>
    api.get<Deployment>(`/api/ta/deployments/${id}`),

  signDeploymentContract: (
    id: number | string,
    data: { party: "WORKER" | "CLIENT"; notes?: string }
  ) => api.post<Deployment>(`/api/ta/deployments/${id}/sign-contract`, data),

  updateDeploymentContract: (
    id: number | string,
    data: { contractDocumentUrl?: string | null; contractTerms?: string | null; contractStatus?: string | null; contractEnd?: string | null }
  ) => api.patch<Deployment>(`/api/ta/deployments/${id}/contract`, data),

  recordDeploymentReview: (id: number | string, data: { nextReviewAt: string; notes?: string }) =>
    api.post<{ id: number; deploymentId: number; reviewedAt: string; nextReviewAt: string | null }>(`/api/ta/deployments/${id}/reviews`, data),

  // -------------------------------------------------------------
  // 10. Post-Hire & Digital 201 Document Upload
  // -------------------------------------------------------------
  uploadPostHireDocument: (applicationId: number | string, formData: FormData) =>
    api.upload(`/api/ta/applications/${applicationId}/documents`, formData),

  // -------------------------------------------------------------
  // 11. Analytics & Operations Intelligence
  // -------------------------------------------------------------
  getDashboardSummary: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<TADeliveryDashboard>(`/api/ta/analytics/dashboard${buildTAAnalyticsQueryString(filters)}`),

  getPendingActions: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<TAPendingActionItem[]>(`/api/ta/analytics/pending-actions${buildTAAnalyticsQueryString(filters)}`),

  getFilterOptions: () =>
    api.get<AnalyticsFilterOptions>("/api/ta/analytics/filters"),

  // Legacy Analytics & Exports (Preserved)
  getPipelineAnalytics: () =>
    api.get<PipelineAnalytics>("/api/ta/analytics/pipeline"),

  getComplianceOverview: (params?: { stage?: string }) =>
    api.get<ComplianceAnalytics>(
      params?.stage
        ? `/api/ta/analytics/compliance?stage=${encodeURIComponent(params.stage)}`
        : "/api/ta/analytics/compliance"
    ),

  exportPipelineReport: (format: "pdf" | "xlsx" = "pdf", filters?: Partial<AnalyticsFilterState>) => {
    const qs = buildTAAnalyticsQueryString(filters);
    const filterParams = qs.startsWith("?") ? qs.substring(1) : qs;
    return api.blob(`/api/ta/reports/pipeline?format=${format}${filterParams ? `&${filterParams}` : ""}`);
  },

  exportDeploymentReport: (format: "pdf" | "xlsx" = "pdf", filters?: Partial<AnalyticsFilterState>) => {
    const qs = buildTAAnalyticsQueryString(filters);
    const filterParams = qs.startsWith("?") ? qs.substring(1) : qs;
    return api.blob(`/api/ta/reports/deployments?format=${format}${filterParams ? `&${filterParams}` : ""}`);
  },
};
