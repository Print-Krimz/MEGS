import { api } from "./client";
import type {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  SetupAccountRequest,
  SetupAccountResponse,
  User,
} from "../types/auth.types";

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>("/api/auth/login", data),

  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>("/api/auth/register", data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    api.post<{ message: string; debugResetLink?: string }>("/api/auth/forgot-password", data),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<{ message: string }>("/api/auth/reset-password", data),

  setupAccount: (data: SetupAccountRequest) =>
    api.post<SetupAccountResponse>("/api/auth/setup-account", data),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<{ message: string }>("/api/auth/change-password", data),

  logout: () => api.post<null>("/api/auth/logout"),

  getMe: () => api.get<{ user: User }>("/api/me").then((res) => res.user),
};
