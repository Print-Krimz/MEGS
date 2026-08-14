import { apiClient } from './client';
import type {
  User,
  AuthSession,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  SetupAccountRequest,
  ApiResponse,
} from '../types/api';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<ApiResponse<AuthSession>> => {
    return apiClient.post<AuthSession>('/api/auth/login', credentials);
  },

  register: async (data: RegisterRequest): Promise<ApiResponse<{ id: string; email: string; role: string }>> => {
    return apiClient.post('/api/auth/register', data);
  },

  logout: async (): Promise<ApiResponse<null>> => {
    return apiClient.post<null>('/api/auth/logout');
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<ApiResponse<{ message: string; debugResetLink?: string }>> => {
    return apiClient.post('/api/auth/forgot-password', data);
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<ApiResponse<null>> => {
    return apiClient.post<null>('/api/auth/reset-password', data);
  },

  changePassword: async (data: ChangePasswordRequest): Promise<ApiResponse<null>> => {
    return apiClient.post<null>('/api/auth/change-password', data);
  },

  setupAccount: async (data: SetupAccountRequest): Promise<ApiResponse<User>> => {
    return apiClient.post<User>('/api/auth/setup-account', data);
  },

  getCurrentUser: async (): Promise<ApiResponse<{ user: User }>> => {
    return apiClient.get<{ user: User }>('/api/me');
  },
};
