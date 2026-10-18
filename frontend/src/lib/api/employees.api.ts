import { api } from "./client";
import type {
  Employee,
  Digital201Aggregate,
  Deployment,
  EmploymentEvent,
  EmployeeListQuery,
  UpdateEmployeeDetailsDto,
} from "../types/employee.types";
import type { EmploymentStatus } from "../types/enums";
import type { PaginatedListResponse } from "../types/api.types";

export const employeesApi = {
  getRedeploymentQueue: () => api.get<RedeploymentQueueResponse>("/api/employees/redeployment-queue"),
  getRedeploymentQueuePage: (query: { page: number; pageSize: number; search?: string; stage?: RedeploymentStage | null }, options?: RequestInit) => {
    const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
    const search = query.search?.trim();
    if (search) params.append("search", search);
    if (query.stage) params.append("stage", query.stage);
    return api.get<RedeploymentQueuePageResponse>(`/api/employees/redeployment-queue?${params.toString()}`, options);
  },
  getRedeploymentQueueSummary: (options?: RequestInit) => api.get<RedeploymentQueueSummary>("/api/employees/redeployment-queue/summary", options),
  /** With employeeIds, only those workers are scored (at most 25); without, every queued worker is. */
  getRedeploymentSuggestions: (employeeIds?: number[], options?: RequestInit) =>
    api.get<RedeploymentSuggestionsResponse>(
      `/api/employees/redeployment-queue/suggestions${employeeIds ? `?employeeIds=${employeeIds.join(",")}` : ""}`,
      options,
    ),
  updateRedeploymentFollowUp: (id: number, data: { ownerId: string | null; followUpAt: string | null; notes: string }) => api.patch(`/api/employees/${id}/redeployment`, data),
  getCredentialAlerts: () => api.get<EmployeeCredentialAlert[]>("/api/employees/credential-alerts"),
  listEmployees: (query?: EmployeeListQuery, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (query?.status) params.append("status", query.status);
    if (query?.department) params.append("department", query.department);
    const search = query?.search?.trim();
    if (search) params.append("search", search);
    if (query?.limit) params.append("limit", String(query.limit));
    if (query?.offset) params.append("offset", String(query.offset));

    const qs = params.toString();
    return api.get<Employee[]>(`/api/employees${qs ? `?${qs}` : ""}`, options);
  },

  getEmployee: (id: number | string) =>
    api.get<Employee>(`/api/employees/${id}`),

  getDigital201: (id: number | string) =>
    api.get<Digital201Aggregate>(`/api/employees/${id}/digital-201`),

  getEmployeeDetails: (id: number | string) =>
    api.get<Digital201Aggregate>(`/api/employees/${id}/digital-201`),

  getMyDigital201: () =>
    api.get<Digital201Aggregate>("/api/employees/me/digital-201"),

  getEmploymentHistory: (id: number | string) =>
    api.get<EmploymentEvent[]>(`/api/employees/${id}/employment-history`),

  updateEmployeeStatus: (
    id: number | string,
    data: { status: EmploymentStatus; notes?: string; reason?: string }
  ) => api.patch<Employee>(`/api/employees/${id}/status`, data),

  createEmployeeDeployment: (
    id: number | string,
    data: { clientId: number; mrfId?: number; site?: string; contractStart?: string; contractEnd?: string; notes?: string }
  ) => api.post<Deployment>(`/api/employees/${id}/deployments`, data),

  endEmployeeDeployment: (
    deploymentId: number | string,
    data: { actualEnd: string; disposition: "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED"; reason: string }
  ) => api.post<Deployment>(`/api/employees/deployments/${deploymentId}/end`, data),

  updateEmployeeDetails: (
    id: number | string,
    data: UpdateEmployeeDetailsDto
  ) => api.patch<Digital201Aggregate>(`/api/employees/${id}/details`, data),
};

export interface EmployeeCredentialAlert {
  requirementId: number;
  documentId: number | null;
  documentLabel: string;
  reviewStatus: string;
  validityStatus: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY";
  issuedAt?: string | null;
  expiresAt?: string | null;
  alertType: "REVIEW_REQUIRED" | "VALIDITY_UNKNOWN" | "EXPIRED" | "EXPIRING_SOON" | "UPDATE_OVERDUE";
  updateRequestReason?: string | null;
  updateRequestDeadline?: string | null;
  employeeId: number;
  employeeNumber: string;
  employeeName: string;
  employeeStatus: string;
  clientName: string;
  jobTitle: string;
}

export interface RedeploymentJobSuggestion {
  jobId: number;
  title: string;
  clientName: string | null;
  location: string | null;
  sameClient: boolean;
  basis: "SAME_CLIENT" | "PROFILE_MATCH" | "KEYWORDS";
  matchPercent: number | null;
  sharedKeywords: string[];
}

export interface ReusableDocument {
  label: string;
  expiresAt: string | null;
  /** Reused at any client. Otherwise only at one of `clientIds`. */
  general: boolean;
  clientIds: number[];
}

export interface RedeploymentSuggestionsResponse {
  items: Record<number, { total: number; suggestions: RedeploymentJobSuggestion[]; reusableDocuments: ReusableDocument[] }>;
}

export type RedeploymentStage ="NEEDS_PLACEMENT" | "WAITING_FOR_REPLY" | "IN_PROGRESS";

export interface RedeploymentQueueSummary {
  total: number;
  stages: Record<RedeploymentStage, number>;
}

export interface RedeploymentQueueResponse {
  staff: Array<{ id: string; email: string }>;
  items: Array<{
    stage: RedeploymentStage; pastClients: Array<{ id: number; name: string }>; waitingSince: string | null; pendingInvitation: { id: number; title: string } | null;
    id: number; employeeNumber: string; applicantProfileId: number | null; name: string; previousClient: string | null; previousRole: string | null;
    availableAt: string | null; followUpAt: string | null; ownerId: string | null; ownerEmail: string | null; notes: string | null; nextAction: string;
    applications: Array<{ id: number; status: string; title: string; client: string | null }>;
  }>;
}

export interface RedeploymentQueuePageResponse extends PaginatedListResponse<RedeploymentQueueResponse["items"][number]> {
  staff: RedeploymentQueueResponse["staff"];
  summary: RedeploymentQueueSummary;
}
