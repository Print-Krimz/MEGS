import { api } from "./client";
import type { User } from "../types/auth.types";
import type {
  CandidateScoringConfiguration,
  UpdateScoringConfigDto,
  AuditLog,
  AuditLogQueryFilters,
  RevalidationStatusResponse,
  QualityMetricsResponse,
} from "../types/admin.types";
import type { Role } from "../types/enums";

export interface InviteTADto {
  email: string;
  firstName?: string;
  lastName?: string;
}

import type {
  AdminOverviewStats,
  RecruitmentActivityTrend,
  FunnelAnalytics,
  BottleneckItem,
  JobDemandItem,
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
  if (filters.stage) params.append("stage", filters.stage);
  if (filters.recruiterId) params.append("recruiterId", filters.recruiterId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  // -------------------------------------------------------------
  // 1. User & Role Management
  // -------------------------------------------------------------
  listUsers: () =>
    api.get<User[]>("/api/admin/users"),

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

  getRevalidationStatus: () =>
    api.get<RevalidationStatusResponse>("/api/admin/candidate-scoring/revalidation-status"),

  getQualityMetrics: () =>
    api.get<QualityMetricsResponse>("/api/admin/candidate-scoring/quality-metrics"),

  // -------------------------------------------------------------
  // 3. Security Audit Trail
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

  // -------------------------------------------------------------
  // 4. Recruitment Analytics
  // -------------------------------------------------------------
  getDashboardSummary: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<{
      overview: AdminOverviewStats;
      activity: RecruitmentActivityTrend;
      funnel: FunnelAnalytics;
      bottlenecks: BottleneckItem[];
      jobDemands: JobDemandItem[];
      filterOptions: AnalyticsFilterOptions;
    }>(`/api/admin/analytics/dashboard${buildAnalyticsQueryString(filters)}`),

  getOverviewStats: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<AdminOverviewStats>(`/api/admin/analytics/overview${buildAnalyticsQueryString(filters)}`),

  getActivityTrend: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<RecruitmentActivityTrend>(`/api/admin/analytics/activity${buildAnalyticsQueryString(filters)}`),

  getFunnelAnalytics: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<FunnelAnalytics>(`/api/admin/analytics/funnel${buildAnalyticsQueryString(filters)}`),

  getBottlenecks: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<BottleneckItem[]>(`/api/admin/analytics/bottlenecks${buildAnalyticsQueryString(filters)}`),

  getJobDemands: (filters?: Partial<AnalyticsFilterState>) =>
    api.get<JobDemandItem[]>(`/api/admin/analytics/jobs${buildAnalyticsQueryString(filters)}`),

  getFilterOptions: () =>
    api.get<AnalyticsFilterOptions>("/api/admin/analytics/filters"),

  // -------------------------------------------------------------
  // 5. Manpower Request (MRF) Oversight
  // -------------------------------------------------------------
  getMRFDetails: (id: string | number) =>
    api.get<any>(`/api/admin/mrfs/${id}`),

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

