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
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResendOtpRequest,
  ResendOtpResponse,
  User,
} from "../types/auth.types";

export const authApi = {
  login: (data: LoginRequest, turnstileToken?: string) =>
    api.post<LoginResponse>(
      "/api/auth/login",
      data,
      turnstileToken ? { headers: { "x-turnstile-token": turnstileToken } } : undefined
    ),

  register: (data: RegisterRequest, turnstileToken?: string) =>
    api.post<RegisterResponse>(
      "/api/auth/register",
      data,
      turnstileToken ? { headers: { "x-turnstile-token": turnstileToken } } : undefined
    ),

  verifyOtp: (data: VerifyOtpRequest) =>
    api.post<VerifyOtpResponse>("/api/auth/verify-otp", data),

  resendOtp: (data: ResendOtpRequest) =>
    api.post<ResendOtpResponse>("/api/auth/resend-otp", data),

  forgotPassword: (data: ForgotPasswordRequest, turnstileToken?: string) =>
    api.post<{ message: string }>(
      "/api/auth/forgot-password",
      data,
      turnstileToken ? { headers: { "x-turnstile-token": turnstileToken } } : undefined
    ),

  resetPassword: (data: ResetPasswordRequest) =>
    api.post<{ message: string }>("/api/auth/reset-password", data),

  getInvitationDetails: (token: string) =>
    api.get<import("../types/auth.types").InvitationDetailsResponse>(
      `/api/auth/invitation-details?token=${encodeURIComponent(token)}`
    ),

  setupAccount: (data: SetupAccountRequest) =>
    api.post<SetupAccountResponse & { tempToken?: string }>("/api/auth/setup-account", data),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<{ message: string }>("/api/auth/change-password", data),

  enrollMfa: (token?: string) =>
    api.post<import("../types/auth.types").MfaEnrollResponse>(
      "/api/auth/mfa/enroll",
      { token },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    ),

  verifyMfaEnrollment: (data: import("../types/auth.types").VerifyMfaEnrollRequest) =>
    api.post<import("../types/auth.types").VerifyMfaEnrollResponse>(
      "/api/auth/mfa/verify-enrollment",
      data,
      data.token ? { headers: { Authorization: `Bearer ${data.token}` } } : undefined
    ),

  verifyMfaLogin: (data: import("../types/auth.types").VerifyMfaLoginRequest) =>
    api.post<LoginResponse>(
      "/api/auth/mfa/verify-login",
      data,
      data.token ? { headers: { Authorization: `Bearer ${data.token}` } } : undefined
    ),

  verifyMfaRecovery: (data: import("../types/auth.types").VerifyMfaRecoveryRequest) =>
    api.post<LoginResponse & { remainingRecoveryCodes?: number }>("/api/auth/mfa/verify-recovery", data),

  getMfaStatus: () =>
    api.get<import("../types/auth.types").MfaStatusResponse>("/api/auth/mfa/status"),

  resetUserMfa: (userId: string) =>

    api.post<{ message: string }>(`/api/admin/users/${userId}/reset-mfa`, {}),

  logout: () => api.post<null>("/api/auth/logout"),

  getMe: () => api.get<{ user: User }>("/api/me").then((res) => res.user),
};

