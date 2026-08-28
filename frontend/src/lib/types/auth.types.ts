import type { Role } from "./enums";

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  accountStatus: string;
  invitationStatus?: string;
  invitationExpiresAt?: string | null;
  mustChangePassword: boolean;
  invitedAt?: string | null;
  invitedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  applicantProfile?: {
    id: number;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
  } | null;
}

export interface InvitationDetailsResponse {
  valid: boolean;
  email: string;
  maskedEmail: string;
  role: Role;
  expiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user: User;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  factorId?: string;
  challengeId?: string;
  tempToken?: string;
}

export interface MfaEnrollResponse {
  factorId: string;
  type: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export interface VerifyMfaEnrollRequest {
  token: string;
  factorId: string;
  code: string;
}

export interface VerifyMfaEnrollResponse {
  message: string;
  recoveryCodes: string[];
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user: User;
}

export interface VerifyMfaLoginRequest {
  token: string;
  factorId: string;
  challengeId: string;
  code: string;
}

export interface VerifyMfaRecoveryRequest {
  token: string;
  recoveryCode: string;
}

export interface MfaStatusResponse {
  isEnrolled: boolean;
  verifiedFactor?: {
    id: string;
    friendly_name?: string;
    factor_type: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
  allFactors: any[];
}


export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  role: Role;
  accountStatus: string;
  message?: string;
}

export type OtpPurpose = "REGISTRATION" | "PASSWORD_RESET";

export interface VerifyOtpRequest {
  email: string;
  otp: string;
  purpose: OtpPurpose;
}

export interface VerifyOtpResponse {
  message: string;
  resetToken?: string;
}

export interface ResendOtpRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface ResendOtpResponse {
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetupAccountRequest {
  token: string;
  password: string;
}

export interface SetupAccountResponse {
  message: string;
  user: User;
}

export interface InviteTARequest {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface InviteTAResponse {
  message: string;
  user: User;
  debugSetupLink?: string;
}
