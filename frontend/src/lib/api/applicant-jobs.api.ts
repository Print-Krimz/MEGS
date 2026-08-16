import { api } from "./client";
import type { JobPosting, Application } from "../types/application.types";

export interface JobQueryFilters {
  search?: string;
  location?: string;
  department?: string;
  page?: number;
  limit?: number;
}

export interface JobDetailResponse extends JobPosting {
  alreadyApplied?: boolean;
  applicationId?: number;
  salaryRange?: string;
  department?: string;
}

export type ApplicationDetailResponse = Application;

export const applicantJobsApi = {
  // Get list of open jobs
  getJobs: (filters?: JobQueryFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.location) params.append("location", filters.location);
    if (filters?.department) params.append("department", filters.department);
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));

    const qs = params.toString();
    return api.get<JobPosting[]>(`/api/applicant-jobs/jobs${qs ? `?${qs}` : ""}`);
  },

  // Get job detail by ID
  getJobDetail: (id: number | string) =>
    api.get<JobDetailResponse>(`/api/applicant-jobs/jobs/${id}`),

  // Apply to a job posting (supports multipart with optional file or JSON)
  applyToJob: (id: number | string, body?: FormData | { resumeUrl?: string }) => {
    if (body instanceof FormData) {
      return api.upload<Application>(`/api/applicant-jobs/jobs/${id}/apply`, body);
    }
    return api.post<Application>(`/api/applicant-jobs/jobs/${id}/apply`, body);
  },

  // Get current applicant's applications
  getMyApplications: () =>
    api.get<ApplicationDetailResponse[]>("/api/applicant-jobs/my-applications"),

  // Get specific application detail
  getApplicationDetail: (id: number | string) =>
    api.get<ApplicationDetailResponse>(`/api/applicant-jobs/applications/${id}`),

  // Upload compliance document
  uploadComplianceDocument: (requirementId: number | string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload<any>(`/api/applicant-jobs/compliance/${requirementId}/upload`, formData);
  },
};
