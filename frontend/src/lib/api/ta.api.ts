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
  ApplicationSource,
  CheckInDetail,
  BulkSummary,
  CheckInSummary,
  WalkInBiodataRead,
  WalkInMatch,
  WalkInSlip,
  RescheduleRequest,
} from "../types/application.types";
import type {
  ManpowerRequest,
  ResumeAnalysisStatus,
  CreateMRFDto,
  UpdateMRFDto,
  MRFComplianceTemplate,
  CreateJobDto,
  UpdateJobDto,
  ScheduleInterviewDto,
  ScheduleContractSigningDto,
  ApproveRescheduleDto,
  UpdateInterviewResultDto,
  EndorseCandidateDto,
  AddComplianceRequirementDto,
  ReviewComplianceDto,
  DeployCandidateDto,
  UpdateDeploymentStatusDto,
  TalentPoolMembership,
  TalentPoolSearchDto,
  TalentPoolMatchResult,
  TalentPoolSearchResult,
  SendTalentPoolInvitationDto,
  BatchSendTalentPoolInvitationsDto,
  TalentPoolInvitationRecord,
  PipelineAnalytics,
  ComplianceAnalytics,
  InterviewSLASummary,
  InterviewSLAPage,
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

export interface BulkUploadResult {
  requirementId: number;
  status: "uploaded" | "failed";
  error?: string;
}

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
  /** Summary list order; omitted means best match. */
  sort?: "match" | "newest" | "oldest" | "waiting";
  needsAction?: boolean;
  openOnly?: boolean;
  source?: ApplicationSource;
  page?: number;
  limit?: number;
  summary?: boolean;
}

export interface ApplicationCounts {
  total: number;
  byStatus: Partial<Record<string, number>>;
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
  awaitingStart: number;
}

const toTalentPoolSearchResult = (
  res: Partial<TalentPoolSearchResult> | TalentPoolMatchResult[] | null | undefined
): TalentPoolSearchResult => {
  if (Array.isArray(res)) return { items: res, unsearchableCount: 0 };
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    unsearchableCount: typeof res?.unsearchableCount === "number" ? res.unsearchableCount : 0,
    requirementClarity: res?.requirementClarity,
  };
};

export type MRFFileField =
  | "title" | "description" | "headcount" | "location" | "targetFillDate" | "priority" | "employmentType" | "workArrangement"
  | "requiredSkills" | "requiredExperience" | "requiredEducation" | "requiredCertifications"
  | "salaryRangeMin" | "salaryRangeMax" | "ageMin" | "ageMax" | "genderPreference" | "tattooPolicy";

/** What reading a manpower request form found. Nothing is saved. */
export interface MRFFileReading {
  status: "SUCCESS" | "UNREADABLE";
  fields: Partial<{
    title: string; description: string; headcount: number; location: string; targetFillDate: string;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; employmentType: string; workArrangement: string; requiredSkills: string; requiredExperience: string;
    requiredEducation: string; requiredCertifications: string; salaryRangeMin: number; salaryRangeMax: number;
    ageMin: number; ageMax: number; genderPreference: "ANY" | "MALE" | "FEMALE";
    tattooPolicy: "ALLOWED" | "NO_VISIBLE" | "NONE";
  }>;
  issues: Partial<Record<MRFFileField, "missing" | "invalid" | "uncertain">>;
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

  /** Stage counts for the list's filters (the stage itself, sort and paging are ignored). */
  countApplications: (filters: Omit<ApplicationQueryFilters, "status" | "sort" | "page" | "limit" | "summary">, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters.jobId) params.append("jobId", String(filters.jobId));
    if (filters.clientId) params.append("clientId", String(filters.clientId));
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.isArchived !== undefined) params.append("isArchived", String(filters.isArchived));
    if (filters.returning) params.append("returning", "true");
    if (filters.needsAction) params.append("needsAction", "true");
    if (filters.openOnly) params.append("openOnly", "true");
    if (filters.source) params.append("source", filters.source);
    const qs = params.toString();
    return api.get<ApplicationCounts>(`/api/ta/applications/counts${qs ? `?${qs}` : ""}`, options);
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
    if (filters.sort && filters.sort !== "match") params.append("sort", filters.sort);
    if (filters.needsAction) params.append("needsAction", "true");
    if (filters.openOnly) params.append("openOnly", "true");
    if (filters.source) params.append("source", filters.source);
    params.append("page", String(filters.page));
    params.append("limit", String(filters.limit));
    params.append("summary", "true");
    return api.get<PaginatedListResponse<TAApplicationSummary>>(
      `/api/ta/applications?${params.toString()}`,
      options,
    );
  },

  checkWalkInDuplicate: (
    params: { phone?: string; firstName?: string; lastName?: string; birthDate?: string },
    options?: RequestInit,
  ) => {
    const qs = new URLSearchParams();
    if (params.phone) qs.append("phone", params.phone);
    if (params.firstName) qs.append("firstName", params.firstName);
    if (params.lastName) qs.append("lastName", params.lastName);
    if (params.birthDate) qs.append("birthDate", params.birthDate);
    return api.get<{ matches: WalkInMatch[] }>(`/api/ta/walk-ins/check-duplicate?${qs.toString()}`, options);
  },

  createWalkIn: (formData: FormData) => api.upload<WalkInSlip>("/api/ta/walk-ins", formData),

  /** Reads a bio-data file and returns what it says. Saves nothing. */
  readWalkInBiodata: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.upload<WalkInBiodataRead>("/api/ta/walk-ins/read-biodata", body);
  },

  listCheckIns: (options?: RequestInit) =>
    api.get<{ items: CheckInSummary[] }>("/api/ta/walk-ins/check-ins", options),

  getCheckIn: (id: number | string, options?: RequestInit) =>
    api.get<CheckInDetail>(`/api/ta/walk-ins/check-ins/${id}`, options),

  getCheckInBiodata: (id: number | string): Promise<Blob> => api.blob(`/api/ta/walk-ins/check-ins/${id}/biodata`),

  confirmCheckIn: (id: number | string, formData: FormData) =>
    api.upload<WalkInSlip>(`/api/ta/walk-ins/check-ins/${id}/confirm`, formData),

  dismissCheckIn: (id: number | string, reason: string) =>
    api.post<{ ok?: boolean }>(`/api/ta/walk-ins/check-ins/${id}/dismiss`, { reason }),

  reissueWalkInSlip: (applicationId: number | string) =>
    api.post<WalkInSlip>(`/api/ta/walk-ins/${applicationId}/slip`),

  recordAssistedResponse: (
    invitationId: number | string,
    body: {
      decision: "ACCEPT" | "DECLINE";
      channel: "ASSISTED_PHONE" | "IN_PERSON";
      declineReason?: string;
      notes?: string;
    },
  ) =>
    api.post<{ status: "ACCEPTED" | "DECLINED"; applicationId?: number }>(
      `/api/ta/talent-pool/invitations/${invitationId}/assisted-response`,
      body,
    ),

  sendOfferSmsLink: (invitationId: number | string) =>
    api.post<{ sentTo: string; expiresAt: string | null }>(
      `/api/ta/talent-pool/invitations/${invitationId}/sms-link`,
    ),

  getApplication: (id: number | string) =>
    api.get<Application>(`/api/ta/applications/${id}`),

  updateApplicationStatus: (
    id: number | string,
    data: { status: ApplicationStatus; reason?: string; reasonCode?: string }
  ) => api.patch<Application>(`/api/ta/applications/${id}/status`, data),

  recordBackout: (
    id: number | string,
    data: { party: string; reason: string; notes?: string; occurredOn?: string; keepInTalentPool?: boolean }
  ) => api.post<unknown>(`/api/ta/applications/${id}/backout`, data),

  closeApplication: (
    id: number | string,
    data: {
      outcome: "REJECTED" | "BACKED_OUT";
      reasonCode: string;
      disposition: "TALENT_POOL" | "ARCHIVE";
      notes?: string;
      occurredOn?: string;
    }
  ) => api.post<unknown>(`/api/ta/applications/${id}/close`, data),

  archiveApplication: (id: number | string, data: { reason: string }) =>
    api.patch<Application>(`/api/ta/applications/${id}/archive`, data),

  restoreApplication: (id: number | string, data: { reason: string }) =>
    api.patch<Application>(`/api/ta/applications/${id}/restore`, data),

  bulkRejectApplications: (data: {
    ids: number[];
    reasonCode: string;
    disposition: "TALENT_POOL" | "ARCHIVE";
    notes?: string;
  }) => api.post<BulkSummary>("/api/ta/bulk/applications/reject", data),

  bulkArchiveApplications: (data: { ids: number[]; reason: string }) =>
    api.post<BulkSummary>("/api/ta/bulk/applications/archive", data),

  bulkRestoreApplications: (data: { ids: number[]; reason: string }) =>
    api.post<BulkSummary>("/api/ta/bulk/applications/restore", data),

  bulkRecordInterviews: (data: {
    items: { applicationId: number; interviewId: number }[];
    result: "PASS" | "NO_SHOW";
    notes?: string;
  }) => api.post<BulkSummary>("/api/ta/bulk/interviews/result", data),

  bulkDismissCheckIns: (data: { ids: number[]; reason: string }) =>
    api.post<BulkSummary>("/api/ta/bulk/check-ins/dismiss", data),

  bulkCancelInvitations: (data: { ids: number[] }) =>
    api.post<BulkSummary>("/api/ta/bulk/invitations/cancel", data),

  bulkConfirmDeploymentStart: (data: { items: { id: number; actualStart: string }[]; notes: string }) =>
    api.post<BulkSummary>("/api/ta/bulk/deployments/confirm-start", data),

  bulkEndDeployments: (data: {
    ids: number[];
    actualEnd: string;
    reason: string;
    disposition: "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED";
  }) => api.post<BulkSummary>("/api/ta/bulk/deployments/end", data),

  getRecruiterDecisions: (id: number | string) =>
    api.get<RecruiterDecision[]>(`/api/ta/applications/${id}/decisions`),

  confirmContractSigned: (id: number | string) =>
    api.post<Application>(`/api/ta/applications/${id}/contract/signed`, {}),

  deployAfterContractSigning: (id: number | string, data: { startDate: string }) =>
    api.post<Application>(`/api/ta/applications/${id}/contract/deploy`, data),

  updateCandidateProfile: (id: number | string, data: UpdateCandidateProfileDto) =>
    api.patch<ApplicantProfile & { warnings?: string[] }>(`/api/ta/candidates/${id}`, data),

  // -------------------------------------------------------------
  // 2. AI Scoring & Assessment
  // -------------------------------------------------------------
  analyzeApplication: (id: number | string) =>
    api.post<{ success: boolean; score?: number; summary?: string }>(
      `/api/ta/applications/${id}/analyze`,
      {}
    ),

  getAnalysisStatus: (id: number | string) =>
    api.get<ResumeAnalysisStatus>(`/api/ta/applications/${id}/analyze/status`),

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

  getJobTalentPool: async (jobId: number | string, options?: RequestInit): Promise<TalentPoolSearchResult> =>
    toTalentPoolSearchResult(
      await api.get<Partial<TalentPoolSearchResult> | TalentPoolMatchResult[]>(`/api/ta/jobs/${jobId}/talent-pool`, options)
    ),

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
  searchTalentPool: async (data: TalentPoolSearchDto): Promise<TalentPoolSearchResult> =>
    toTalentPoolSearchResult(
      await api.post<Partial<TalentPoolSearchResult> | TalentPoolMatchResult[]>("/api/ta/talent-pool/search", data)
    ),

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

  listMRFsPage: (filters: {
    page: number;
    pageSize: number;
    search?: string;
    clientId?: number | string;
    status?: string;
    priority?: string;
    sortBy?: string;
  }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters.clientId) params.append("clientId", String(filters.clientId));
    if (filters.status) params.append("status", filters.status);
    if (filters.priority) params.append("priority", filters.priority);
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    params.append("page", String(filters.page));
    params.append("pageSize", String(filters.pageSize));
    return api.get<PaginatedListResponse<ManpowerRequest>>(`/api/ta/mrfs?${params.toString()}`, options);
  },

  createMRF: (data: CreateMRFDto) =>
    api.post<ManpowerRequest>("/api/ta/mrfs", data),

  /** Reads a manpower request form (PDF, Word or photo) and returns what it says. Saves nothing. */
  readMRFFile: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.upload<MRFFileReading>("/api/ta/mrfs/read", body);
  },

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

  scheduleContractSigning: (applicationId: number | string, data: ScheduleContractSigningDto) =>
    api.post<{ id: number; contractSigningAt: string; contractSigningLocation: string }>(
      `/api/ta/applications/${applicationId}/contract-signing/schedule`,
      data
    ),

  approveRescheduleRequest: (applicationId: number | string, requestId: number | string, data: ApproveRescheduleDto) =>
    api.post<RescheduleRequest>(`/api/ta/applications/${applicationId}/reschedule-requests/${requestId}/approve`, data),

  rejectRescheduleRequest: (applicationId: number | string, requestId: number | string, data: { decisionNote?: string }) =>
    api.post<RescheduleRequest>(`/api/ta/applications/${applicationId}/reschedule-requests/${requestId}/reject`, data),

  checkInterviewCompliance: () =>
    api.get<InterviewSLASummary>("/api/ta/compliance/interviews"),

  listInterviewCompliancePage: (filters: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    stage?: string;
    position?: string;
    sortField?: string;
    sortDirection?: string;
    /** Only interviews with a scheduled time; `from`/`to` are inclusive Manila dates (YYYY-MM-DD). */
    scheduledOnly?: boolean;
    from?: string;
    to?: string;
  }, options?: RequestInit) => {
    const params = new URLSearchParams();
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.status) params.append("status", filters.status);
    if (filters.stage) params.append("stage", filters.stage);
    if (filters.scheduledOnly) params.append("scheduledOnly", "true");
    if (filters.from) params.append("from", filters.from);
    if (filters.to) params.append("to", filters.to);
    if (filters.position) params.append("position", filters.position);
    if (filters.sortField) params.append("sortField", filters.sortField);
    if (filters.sortDirection) params.append("sortDirection", filters.sortDirection);
    params.append("page", String(filters.page));
    params.append("pageSize", String(filters.pageSize));
    return api.get<InterviewSLAPage>(`/api/ta/compliance/interviews?${params.toString()}`, options);
  },

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

  /** TA uploads a requirement's document on the applicant's behalf (walk-ins have no portal). */
  uploadComplianceDocument: (requirementId: number | string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload<ComplianceRequirement>(`/api/ta/compliance/${requirementId}/upload`, formData);
  },

  /** Uploads several scanned documents at once. Every one lands as Submitted; nothing is approved. */
  bulkUploadComplianceDocuments: (applicationId: number | string, items: { file: File; requirementId: number }[]) => {
    const formData = new FormData();
    items.forEach((item) => formData.append("files", item.file));
    formData.append("mapping", JSON.stringify(items.map((item, fileIndex) => ({ fileIndex, requirementId: item.requirementId }))));
    return api.upload<{ results: BulkUploadResult[] }>(`/api/ta/applications/${applicationId}/compliance/bulk-upload`, formData);
  },

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

  listDeploymentsPage: (filters: { page: number; pageSize: number; search?: string; status?: string; clientId?: number | string }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.clientId) params.append("clientId", String(filters.clientId));
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    params.append("page", String(filters.page));
    params.append("pageSize", String(filters.pageSize));
    return api.get<PaginatedListResponse<Deployment>>(`/api/ta/deployments?${params.toString()}`, options);
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

  // -------------------------------------------------------------
  // 10. Post-Hire & Digital 201 Document Upload
  // -------------------------------------------------------------
  uploadPostHireDocument: (applicationId: number | string, formData: FormData) =>
    api.upload(`/api/ta/applications/${applicationId}/documents`, formData),

  // -------------------------------------------------------------
  // 11. Analytics & Operations Intelligence
  // -------------------------------------------------------------
  getDashboardSummary: (filters?: Partial<AnalyticsFilterState>, signal?: AbortSignal) =>
    api.get<TADeliveryDashboard>(`/api/ta/analytics/dashboard${buildTAAnalyticsQueryString(filters)}`, { signal }),

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
