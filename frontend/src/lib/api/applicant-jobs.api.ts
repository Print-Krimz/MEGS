import { api } from "./client";
import type {
  ApplicantApplicationSummary,
  JobPosting as BaseJobPosting,
  Application,
  ComplianceRequirement,
} from "../types/application.types";
import type { ApplicantJobInvitation, RespondInvitationDto } from "../types/applicant.types";
import type { PaginatedListResponse } from "../types/api.types";
import type { ApplicationStatus } from "../types/enums";

export interface ApplicantApplicationSummaryResponse {
  items: ApplicantApplicationSummary[];
  total: number;
  statusTotals?: Partial<Record<ApplicationStatus, number>>;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

export interface MyApplicationsQuery {
  summary?: boolean;
  page?: number;
  limit?: number;
}

export interface MyDocumentRequirement extends Omit<ComplianceRequirement, "isRequired" | "createdAt" | "updatedAt"> {
  jobTitle: string;
  clientName: string | null;
}

/** One entry per document type in the applicant's library (latest stored copy of that type). */
export interface MyDocumentLibraryItem {
  label: string;
  documentId: number;
  originalName: string;
  mimeType: string;
  uploadedAt: string;
  requirementId: number;
  applicationId: number;
  jobTitle: string;
  reviewStatus: ComplianceRequirement["reviewStatus"];
  validityStatus: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";
  issuedAt: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export interface ActiveDeploymentInfo {
  isCurrentlyDeployed: boolean;
  clientName?: string;
  positionTitle?: string;
}

export interface JobPosting extends BaseJobPosting {
  activeDeployment?: ActiveDeploymentInfo;
}

export interface JobQueryFilters {
  search?: string;
  location?: string;
  /** Monthly salary range in pesos. */
  salaryMin?: number;
  salaryMax?: number;
  department?: string;
}

export interface PaginatedJobQueryFilters extends JobQueryFilters {
  page: number;
  limit: number;
}

export interface OpenEmployerSummary {
  employers: Array<{ name: string; industry?: string | null; jobCount: number }>;
}

export interface JobDetailResponse extends JobPosting {
  alreadyApplied?: boolean;
  applicationId?: number;
  salaryRange?: string;
  department?: string;
  activeDeployment?: ActiveDeploymentInfo;
}

export type ApplicationDetailResponse = Application;

export const applicantJobsApi = {
  getMyDocuments: () => api.get<MyDocumentRequirement[]>("/api/applicant-jobs/my-documents"),
  getMyDocumentLibrary: () => api.get<MyDocumentLibraryItem[]>("/api/applicant-jobs/my-documents/library"),
  // Get list of open jobs
  getJobs: (filters?: JobQueryFilters, options?: RequestInit) => {
    const params = new URLSearchParams();
    const search = filters?.search?.trim();
    if (search) params.append("search", search);
    if (filters?.location) params.append("location", filters.location);
    if (filters?.department) params.append("department", filters.department);
    const qs = params.toString();
    return api.get<JobPosting[]>(
      `/api/applicant-jobs/jobs${qs ? `?${qs}` : ""}`,
      options,
    );
  },

  getJobsPage: (filters: PaginatedJobQueryFilters, options?: RequestInit) => {
    const params = new URLSearchParams();
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.location) params.append("location", filters.location);
    if (filters.salaryMin) params.append("salaryMin", String(filters.salaryMin));
    if (filters.salaryMax) params.append("salaryMax", String(filters.salaryMax));
    if (filters.department) params.append("department", filters.department);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    return api.get<PaginatedListResponse<JobPosting>>(
      `/api/applicant-jobs/jobs?${params.toString()}`,
      options,
    );
  },

  getOpenEmployerSummary: (options?: RequestInit) =>
    api.get<OpenEmployerSummary>("/api/applicant-jobs/employers/summary", options),

  // Get job detail by ID
  getJobDetail: (id: number | string, options?: RequestInit) =>
    api.get<JobDetailResponse>(`/api/applicant-jobs/jobs/${id}`, options),

  withdrawApplication: (id: number | string, data: { reason: string; notes?: string }) =>
    api.post<{ applicationId: number; status: string }>(`/api/applicant-jobs/applications/${id}/withdraw`, data),

  // Apply to a job posting (supports multipart with optional file or JSON)
  applyToJob: (id: number | string, body?: FormData | { resumeUrl?: string }) => {
    if (body instanceof FormData) {
      return api.upload<Application>(`/api/applicant-jobs/jobs/${id}/apply`, body);
    }
    return api.post<Application>(`/api/applicant-jobs/jobs/${id}/apply`, body);
  },

  // Get current applicant's applications
  getMyApplications: (options?: RequestInit) =>
    api.get<ApplicationDetailResponse[]>("/api/applicant-jobs/my-applications", options),

  getMyApplicationSummaries: (query?: MyApplicationsQuery, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (query?.summary) params.append("summary", "true");
    if (query?.page) params.append("page", String(query.page));
    if (query?.limit) params.append("limit", String(query.limit));
    const qs = params.toString();
    return api.get<ApplicantApplicationSummaryResponse>(
      `/api/applicant-jobs/my-applications${qs ? `?${qs}` : ""}`,
      options,
    );
  },

  // Get active deployment status for applicant
  getActiveDeployment: () =>
    api.get<ActiveDeploymentInfo>("/api/applicant-jobs/active-deployment"),

  // Get specific application detail
  getApplicationDetail: (id: number | string, options?: RequestInit) =>
    api.get<ApplicationDetailResponse>(`/api/applicant-jobs/applications/${id}`, options),

  // Upload compliance document
  uploadComplianceDocument: (requirementId: number | string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload<any>(`/api/applicant-jobs/compliance/${requirementId}/upload`, formData);
  },

  // Attach a document already in the applicant's library to another requirement (TA still reviews it)
  reuseComplianceDocument: (requirementId: number | string, documentId: number) =>
    api.post<ComplianceRequirement>(`/api/applicant-jobs/compliance/${requirementId}/reuse`, { documentId }),

  // Remove every saved job
  clearSavedJobs: () =>
    api.delete<{ success: boolean; removed: number }>("/api/applicant-jobs/saved-jobs"),

  // Get list of saved job IDs
  getSavedJobIds: () =>
    api.get<number[]>("/api/applicant-jobs/saved-jobs/ids"),

  // Get full list of saved jobs
  getSavedJobs: () =>
    api.get<JobPosting[]>("/api/applicant-jobs/saved-jobs"),

  // Get paginated list of saved jobs
  getSavedJobsPage: (filters: PaginatedJobQueryFilters, options?: RequestInit) => {
    const params = new URLSearchParams();
    const search = filters.search?.trim();
    if (search) params.append("search", search);
    if (filters.location) params.append("location", filters.location);
    if (filters.salaryMin) params.append("salaryMin", String(filters.salaryMin));
    if (filters.salaryMax) params.append("salaryMax", String(filters.salaryMax));
    if (filters.department) params.append("department", filters.department);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    return api.get<PaginatedListResponse<JobPosting>>(
      `/api/applicant-jobs/saved-jobs?${params.toString()}`,
      options,
    );
  },

  // Bookmark a job
  saveJob: (jobId: number | string) =>
    api.post<{ success: boolean }>(`/api/applicant-jobs/jobs/${jobId}/save`, {}),

  // Remove a job bookmark
  unsaveJob: (jobId: number | string) =>
    api.delete<{ success: boolean }>(`/api/applicant-jobs/jobs/${jobId}/save`),

  // Get job invitations for applicant
  getMyInvitations: (options?: RequestInit) =>
    api.get<ApplicantJobInvitation[]>("/api/applicant-jobs/invitations", options),

  // Respond to a job invitation
  respondToInvitation: (invitationId: number | string, body: RespondInvitationDto) =>
    api.post<{ success: boolean; message: string; application?: Application; invitation: any }>(
      `/api/applicant-jobs/invitations/${invitationId}/respond`,
      body
    ),
};
