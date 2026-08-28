import { z } from "zod";

export const authSchema = {
  register: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
  login: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      password: z.string().min(1, "Password is required"),
    }),
  }),
  forgotPassword: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
    }),
  }),
  resetPassword: z.object({
    body: z.object({
      token: z.string().min(1, "Reset token is required"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, "Current password is required"),
      newPassword: z.string().min(8, "New password must be at least 8 characters long"),
    }),
  }),
  setupAccount: z.object({
    body: z.object({
      token: z.string().min(1, "Setup token is required"),
      password: z.string().min(8, "Password must be at least 8 characters long"),
    }),
  }),
  getInvitationDetails: z.object({
    query: z.object({
      token: z.string().min(1, "Invitation token is required"),
    }),
  }),
  verifyOtp: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      otp: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits"),
      purpose: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
    }),
  }),
  resendOtp: z.object({
    body: z.object({
      email: z.string().email("Invalid email format"),
      purpose: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
    }),
  }),
  enrollMfa: z.object({
    body: z.object({
      token: z.string().optional(),
    }),
  }),
  verifyMfaEnrollment: z.object({
    body: z.object({
      token: z.string().min(1, "Authentication token is required"),
      factorId: z.string().min(1, "Factor ID is required"),
      code: z.string().regex(/^\d{6}$/, "MFA code must be exactly 6 digits"),
    }),
  }),
  verifyMfaLogin: z.object({
    body: z.object({
      token: z.string().min(1, "Authentication token is required"),
      factorId: z.string().min(1, "Factor ID is required"),
      challengeId: z.string().min(1, "Challenge ID is required"),
      code: z.string().regex(/^\d{6}$/, "MFA code must be exactly 6 digits"),
    }),
  }),
  verifyMfaRecovery: z.object({
    body: z.object({
      token: z.string().min(1, "Authentication token is required"),
      recoveryCode: z.string().min(8, "Recovery code is required"),
    }),
  }),
};

