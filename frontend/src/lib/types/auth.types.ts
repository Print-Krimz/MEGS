import type { Role } from "./enums";

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  accountStatus: string;
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
  role: Role;
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
