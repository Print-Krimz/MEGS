import { api } from "./client";
import type { User } from "../types/auth.types";
import type {
  CandidateScoringConfiguration,
  UpdateScoringConfigDto,
  AuditLog,
  AuditLogQueryFilters,
  DatabaseBackupRecord,
  DatabaseRestoreRecord,
  QualityMetricsResponse,
} from "../types/admin.types";
import type { Role } from "../types/enums";
import type { PaginatedListResponse } from "../types/api.types";

export interface AdminUserListItem {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  accountStatus: string;
  invitationStatus?: string;
  createdAt: string;
  /** Last sign-in from Supabase Auth; null when the person has never signed in. */
  lastLoginAt?: string | null;
  applicantProfile?: {
    id?: number;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  } | null;
}

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: Role | "";
  status?: AdminUserStatus | "";
  lastLogin?: AdminUserLastLogin | "";
}

export type AdminUserLastLogin = "7d" | "30d" | "never";

export type AdminUserStatus = "active" | "inactive" | "invited";

export interface AdminUserSummary {
  totalUsers: number;
  recruiters: number;
  administrators: number;
  pendingInvitations: number;
  expiredInvitations: number;
  inactiveAccounts: number;
  /** Failed scoring revalidation jobs. */
  failedJobs: number;
  /** Applicant reschedule requests waiting on a recruiter. */
  pendingRequests: number;
}

export interface InviteTADto {
  email: string;
  firstName?: string;
  lastName?: string;
}

import type {
  AdminDeliveryDashboard,
  AnalyticsFilterOptions,
  AnalyticsFilterState,
} from "../types/analytics.types";

function buildAnalyticsQueryString(filters?: Partial<AnalyticsFilterState>): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.range) params.append("range", filters.range);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);
  if (filters.clientId) params.append("clientId", String(filters.clientId));
  if (filters.mrfId) params.append("mrfId", String(filters.mrfId));
  if (filters.jobPostingId) params.append("jobPostingId", String(filters.jobPostingId));
  if (filters.recruiterId) params.append("recruiterId", filters.recruiterId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  // -------------------------------------------------------------
  // 1. User & Role Management
  // -------------------------------------------------------------
  listUsers: (options?: RequestInit) =>
    api.get<User[]>("/api/admin/users", options),

  listUsersPage: (filters: AdminUserListQuery & { page: number; limit: number }, options?: RequestInit) => {
    const params = new URLSearchParams();
    if (filters?.page) params.append("page", String(filters.page));
    if (filters?.limit) params.append("limit", String(filters.limit));
    const search = filters?.search?.trim();
    if (search) params.append("search", search);
    if (filters?.role) params.append("role", filters.role);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.lastLogin) params.append("lastLogin", filters.lastLogin);
    const qs = params.toString();
    return api.get<PaginatedListResponse<AdminUserListItem>>(
      `/api/admin/users${qs ? `?${qs}` : ""}`,
      options,
    );
  },

  getUserSummary: (options?: RequestInit) =>
    api.get<AdminUserSummary>("/api/admin/users/summary", options),

  inviteTA: (data: InviteTADto) =>
    api.post<User>("/api/admin/invite-ta", data),

  resendTAInvitation: (id: string) =>
    api.post<User>(`/api/admin/users/${id}/resend-invite`, {}),

  cancelTAInvitation: (id: string) =>
    api.post<{ message: string }>(`/api/admin/users/${id}/cancel-invite`, {}),

  updateUserRole: (id: string, role: Role) =>
    api.patch<User>(`/api/admin/users/${id}/role`, { role }),

  updateUserStatus: (id: string, isActive: boolean) =>
    api.patch<User>(`/api/admin/users/${id}/status`, { isActive }),

  // -------------------------------------------------------------
  // 2. Candidate AI Scoring Configuration
  // -------------------------------------------------------------
  getScoringConfig: () =>
    api.get<CandidateScoringConfiguration>("/api/admin/candidate-scoring/configuration"),

  validateScoringConfig: (data: Partial<UpdateScoringConfigDto>) =>
    api.post<{ valid: boolean; errors?: string[] }>(
      "/api/admin/candidate-scoring/configuration/validate",
      data
    ),

  updateScoringConfig: (data: UpdateScoringConfigDto) =>
    api.put<CandidateScoringConfiguration>(
      "/api/admin/candidate-scoring/configuration",
      data
    ),

  restoreDefaultScoringConfig: (expectedRevision: number) =>
    api.post<CandidateScoringConfiguration>(
      "/api/admin/candidate-scoring/configuration/restore-defaults",
      { expectedRevision }
    ),

  getScoringConfigHistory: async (cursor?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (cursor) params.append("cursor", cursor);
    if (limit) params.append("limit", String(limit));
    const qs = params.toString();
    const res = await api.get<{ items: CandidateScoringConfiguration[] } | CandidateScoringConfiguration[]>(
      `/api/admin/candidate-scoring/configuration/history${qs ? `?${qs}` : ""}`
    );
    if (res && typeof res === "object" && "items" in res && Array.isArray((res as any).items)) {
      return (res as any).items as CandidateScoringConfiguration[];
    }
    return (Array.isArray(res) ? res : []) as CandidateScoringConfiguration[];
  },

  getQualityMetrics: () =>
    api.get<QualityMetricsResponse>("/api/admin/candidate-scoring/quality-metrics"),

  // -------------------------------------------------------------
  // 3. Security Audit Trail & Report Export
  // -------------------------------------------------------------
  listAuditLogs: (filters?: AuditLogQueryFilters) => {
    const params = new URLSearchParams();
    if (filters?.action) params.append("action", filters.action);
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.entity) params.append("entity", filters.entity);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.limit) params.append("limit", String(filters.limit));
    const qs = params.toString();
    return api.get<AuditLog[]>(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },

  exportAuditReport: (format: "pdf" | "csv" | "xlsx" = "pdf", filters?: AuditLogQueryFilters) => {
    const params = new URLSearchParams();
    params.append("format", format);
    if (filters?.action) params.append("action", filters.action);
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.entity) params.append("entity", filters.entity);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return api.blob(`/api/admin/audit-logs/export?${params.toString()}`);
  },

  // -------------------------------------------------------------
  // 4. Database Maintenance & Encrypted Backups / Restores
  // -------------------------------------------------------------
  listDatabaseBackups: (limit = 50) =>
    api.get<DatabaseBackupRecord[]>(`/api/admin/maintenance/backups?limit=${limit}`),

  triggerDatabaseBackup: (customName?: string) =>
    api.post<DatabaseBackupRecord>("/api/admin/maintenance/backup", { customName }),

  renameDatabaseBackup: (id: string, name: string) =>
    api.patch<DatabaseBackupRecord>(`/api/admin/maintenance/backups/${id}/rename`, { name }),

  downloadDatabaseBackup: (id: string) =>
    api.blob(`/api/admin/maintenance/backups/${id}/download`),

  listDatabaseRestores: (limit = 10) =>
    api.get<DatabaseRestoreRecord[]>(`/api/admin/maintenance/restores?limit=${limit}`),

  restoreDatabaseBackup: (id: string) =>
    api.post<DatabaseRestoreRecord>(
      `/api/admin/maintenance/backups/${id}/restore`,
      {}
    ),

  restoreUploadedBackup: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.upload<DatabaseRestoreRecord>(
      "/api/admin/maintenance/backups/restore-upload",
      formData
    );
  },

  cancelMaintenance: () =>
    api.post<{ cancelledBackups: number; cancelledRestores: number }>(
      "/api/admin/maintenance/cancel",
      {}
    ),

  // -------------------------------------------------------------
  // 5. Recruitment Analytics
  // -------------------------------------------------------------
  getDashboardSummary: (filters?: Partial<AnalyticsFilterState>, signal?: AbortSignal) =>
    api.get<AdminDeliveryDashboard>(`/api/admin/analytics/dashboard${buildAnalyticsQueryString(filters)}`, { signal }),

  getFilterOptions: () =>
    api.get<AnalyticsFilterOptions>("/api/admin/analytics/filters"),

  // -------------------------------------------------------------
  // 6. Manpower Request (MRF) Oversight
  // -------------------------------------------------------------
  getMRFDetails: (id: string | number) =>
    api.get<any>(`/api/admin/mrfs/${id}`),

  /** Read-only application detail, opened from the reports. */
  getApplication: (id: string | number) =>
    api.get<any>(`/api/admin/applications/${id}`),

  // -------------------------------------------------------------
  // 7. Ownership: Admin reassigns requisitions, clients and a departing TA's records
  // -------------------------------------------------------------
  assignMrf: (id: string | number, assignedTaId: string | null) =>
    api.patch<{ id: number; assignedTaId: string | null }>(`/api/admin/mrfs/${id}/assignment`, { assignedTaId }),

  assignClient: (id: string | number, assignedTaId: string | null) =>
    api.patch<{ id: number; assignedTaId: string | null }>(`/api/admin/clients/${id}/assignment`, { assignedTaId }),

  reassignTaRecords: (fromTaId: string, toTaId: string) =>
    api.post<{ manpowerRequests: number; clients: number; standaloneJobs: number; redeploymentFollowUps: number }>(
      `/api/admin/users/${fromTaId}/reassign-records`,
      { toTaId },
    ),

  exportPipelineReport: (format: "pdf" | "xlsx" = "pdf", filters?: Partial<AnalyticsFilterState>) => {
    const qs = buildAnalyticsQueryString(filters);
    const filterParams = qs.startsWith("?") ? qs.substring(1) : qs;
    return api.blob(`/api/admin/reports/pipeline?format=${format}${filterParams ? `&${filterParams}` : ""}`);
  },

  exportDeploymentReport: (format: "pdf" | "xlsx" = "pdf", filters?: Partial<AnalyticsFilterState>) => {
    const qs = buildAnalyticsQueryString(filters);
    const filterParams = qs.startsWith("?") ? qs.substring(1) : qs;
    return api.blob(`/api/admin/reports/deployments?format=${format}${filterParams ? `&${filterParams}` : ""}`);
  },
};

