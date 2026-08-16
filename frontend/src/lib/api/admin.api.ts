import { api } from "./client";
import type { User } from "../types/auth.types";
import type {
  CandidateScoringConfiguration,
  UpdateScoringConfigDto,
  AuditLog,
  RevalidationStatusResponse,
  QualityMetricsResponse,
} from "../types/admin.types";
import type { Role } from "../types/enums";

export interface InviteTADto {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface AuditLogQueryFilters {
  action?: string;
  userId?: string;
  entity?: string;
  limit?: number;
}

export const adminApi = {
  // -------------------------------------------------------------
  // 1. User & Role Management
  // -------------------------------------------------------------
  listUsers: () =>
    api.get<User[]>("/api/admin/users"),

  inviteTA: (data: InviteTADto) =>
    api.post<User>("/api/admin/invite-ta", data),

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
    if (filters?.limit) params.append("limit", String(filters.limit));
    const qs = params.toString();
    return api.get<AuditLog[]>(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
