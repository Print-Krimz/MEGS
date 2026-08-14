import { apiClient } from './client';
import type {
  User,
  CandidateScoringConfiguration,
  ScoringQualityMetrics,
  RevalidationStatus,
  AuditLog,
  InviteTARequest,
  ApiResponse,
  Role,
} from '../types/api';

export const adminApi = {
  // ── User Management ───────────────────────
  listUsers: async (params?: {
    role?: Role | string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<User[]>> => {
    return apiClient.get<User[]>('/api/admin/users', params);
  },

  inviteTA: async (
    data: InviteTARequest
  ): Promise<ApiResponse<{ user: User; invitationLink?: string }>> => {
    return apiClient.post('/api/admin/invite-ta', data);
  },

  inviteUser: async (
    data: InviteTARequest
  ): Promise<ApiResponse<{ user: User; invitationLink?: string }>> => {
    return adminApi.inviteTA(data);
  },

  updateUserRole: async (id: string, role: Role): Promise<ApiResponse<User>> => {
    return apiClient.patch<User>(`/api/admin/users/${id}/role`, { role });
  },

  updateUserStatus: async (
    id: string,
    accountStatusOrData: string | boolean | { isActive?: boolean; accountStatus?: string }
  ): Promise<ApiResponse<User>> => {
    const payload =
      typeof accountStatusOrData === 'boolean'
        ? { isActive: accountStatusOrData }
        : typeof accountStatusOrData === 'string'
        ? { accountStatus: accountStatusOrData, isActive: accountStatusOrData === 'ACTIVE' }
        : accountStatusOrData;
    return apiClient.patch<User>(`/api/admin/users/${id}/status`, payload);
  },

  toggleUserStatus: async (id: string, isActive?: boolean): Promise<ApiResponse<User>> => {
    return adminApi.updateUserStatus(id, isActive !== undefined ? isActive : true);
  },

  resendInvite: async (id: string): Promise<ApiResponse<{ success: boolean; message: string }>> => {
    return apiClient.post<{ success: boolean; message: string }>(`/api/admin/users/${id}/resend-invite`);
  },

  // ── Candidate Scoring Configuration ───────
  getConfiguration: async (): Promise<ApiResponse<CandidateScoringConfiguration>> => {
    return apiClient.get<CandidateScoringConfiguration>('/api/admin/candidate-scoring/configuration');
  },

  getActiveScoringConfiguration: async (): Promise<ApiResponse<CandidateScoringConfiguration>> => {
    return adminApi.getConfiguration();
  },

  validateConfiguration: async (
    data: Partial<CandidateScoringConfiguration>
  ): Promise<ApiResponse<{ isValid: boolean; errors?: string[] }>> => {
    return apiClient.post('/api/admin/candidate-scoring/configuration/validate', data);
  },

  updateConfiguration: async (
    data: Partial<CandidateScoringConfiguration> & { expectedRevision?: number }
  ): Promise<ApiResponse<CandidateScoringConfiguration>> => {
    return apiClient.put<CandidateScoringConfiguration>('/api/admin/candidate-scoring/configuration', data);
  },

  createScoringConfiguration: async (
    data: Partial<CandidateScoringConfiguration> & { expectedRevision?: number }
  ): Promise<ApiResponse<CandidateScoringConfiguration>> => {
    return adminApi.updateConfiguration(data);
  },

  restoreDefaults: async (expectedRevision?: number): Promise<ApiResponse<CandidateScoringConfiguration>> => {
    return apiClient.post<CandidateScoringConfiguration>(
      '/api/admin/candidate-scoring/configuration/restore-defaults',
      { expectedRevision }
    );
  },

  getConfigurationHistory: async (params?: {
    cursor?: number;
    limit?: number;
  }): Promise<ApiResponse<CandidateScoringConfiguration[]>> => {
    return apiClient.get<CandidateScoringConfiguration[]>(
      '/api/admin/candidate-scoring/configuration/history',
      params
    );
  },

  listScoringConfigurations: async (params?: {
    cursor?: number;
    limit?: number;
  }): Promise<ApiResponse<CandidateScoringConfiguration[]>> => {
    return adminApi.getConfigurationHistory(params);
  },

  getRevalidationStatus: async (): Promise<ApiResponse<RevalidationStatus>> => {
    return apiClient.get<RevalidationStatus>('/api/admin/candidate-scoring/revalidation-status');
  },

  getQualityMetrics: async (): Promise<ApiResponse<ScoringQualityMetrics>> => {
    return apiClient.get<ScoringQualityMetrics>('/api/admin/candidate-scoring/quality-metrics');
  },

  getScoringQualityMetrics: async (): Promise<ApiResponse<ScoringQualityMetrics>> => {
    return adminApi.getQualityMetrics();
  },

  triggerRevalidation: async (): Promise<ApiResponse<{ message: string; queued?: number }>> => {
    return apiClient.post<{ message: string; queued?: number }>('/api/admin/candidate-scoring/revalidate');
  },

  // ── Audit Logs ────────────────────────────
  listAuditLogs: async (params?: {
    action?: string;
    userId?: string;
    entity?: string;
    search?: string;
    limit?: number;
    page?: number;
  }): Promise<ApiResponse<AuditLog[]>> => {
    return apiClient.get<AuditLog[]>('/api/admin/audit-logs', params);
  },

  // ── Dashboard Overview Helper ─────────────
  getAdminDashboardStats: async (): Promise<
    ApiResponse<{
      totalUsers: number;
      taStaffCount: number;
      activeVersion: number;
      totalAuditLogs: number;
    }>
  > => {
    return apiClient.get('/api/admin/dashboard/stats');
  },
};
