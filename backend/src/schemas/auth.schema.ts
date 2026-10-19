import { z } from "zod";
import { FIELD_LIMITS } from "./field-limits.js";
import { isPhilippinePhone, normalizeToE164 } from "../utils/sms.js";

// Supabase Auth (bcrypt) only reads the first 72 bytes, so NEW passwords are capped in UTF-8 bytes, not characters.
const withinNewPasswordBytes = (value: string) => new TextEncoder().encode(value).length <= FIELD_LIMITS.newPasswordMaxBytes;
const NEW_PASSWORD_BYTES_MESSAGE = `Password must be ${FIELD_LIMITS.newPasswordMaxBytes} bytes or fewer.`;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidAuthIdentifier = (val: string): boolean => {
  const trimmed = val.trim();
  return isPhilippinePhone(trimmed) || EMAIL_REGEX.test(trimmed);
};

const normalizeAuthIdentifier = (val: string): string => {
  const trimmed = val.trim();
  if (isPhilippinePhone(trimmed)) {
    return normalizeToE164(trimmed);
  }
  return trimmed.toLowerCase();
};

const email = z
  .string()
  .trim()
  .max(FIELD_LIMITS.email)
  .refine(isValidAuthIdentifier, "Please enter a valid email address or Philippine mobile number (e.g. 09171234567)")
  .transform(normalizeAuthIdentifier);

const password = (message: string) =>
  z.string().min(8, message).refine(withinNewPasswordBytes, NEW_PASSWORD_BYTES_MESSAGE);
const token = z.string().min(1).max(FIELD_LIMITS.authToken);

const withIdentifierFallback = <T extends z.ZodRawShape>(shape: T) =>
  z.preprocess((input: any) => {
    if (input && typeof input === "object") {
      const copy = { ...input };
      if (!copy.email && copy.identifier) {
        copy.email = copy.identifier;
      }
      return copy;
    }
    return input;
  }, z.object(shape));

export const authSchema = {
  register: z.object({
    body: withIdentifierFallback({
      email,
      identifier: z.string().optional(),
      password: password("Password must be at least 8 characters long"),
    }),
  }),
  login: z.object({
    body: withIdentifierFallback({
      email,
      identifier: z.string().optional(),
      password: z.string().min(1, "Password is required").max(FIELD_LIMITS.password),
    }),
  }),
  forgotPassword: z.object({
    body: withIdentifierFallback({
      email,
      identifier: z.string().optional(),
    }),
  }),
  resetPassword: z.object({
    body: z.object({
      token,
      password: password("Password must be at least 8 characters long"),
    }),
  }),
  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, "Current password is required").max(FIELD_LIMITS.password),
      newPassword: password("New password must be at least 8 characters long"),
    }),
  }),
  setupAccount: z.object({
    body: z.object({
      token,
      password: password("Password must be at least 8 characters long"),
    }),
  }),
  getInvitationDetails: z.object({
    query: z.object({
      token,
    }),
  }),
  verifyOtp: z.object({
    body: withIdentifierFallback({
      email,
      identifier: z.string().optional(),
      otp: z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits"),
      purpose: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
    }),
  }),
  resendOtp: z.object({
    body: withIdentifierFallback({
      email,
      identifier: z.string().optional(),
      purpose: z.enum(["REGISTRATION", "PASSWORD_RESET"]),
    }),
  }),
  enrollMfa: z.object({
    body: z.object({
      token: token.optional(),
    }),
  }),
  verifyMfaEnrollment: z.object({
    body: z.object({
      token,
      factorId: z.string().min(1, "Factor ID is required").max(FIELD_LIMITS.shortText),
      code: z.string().regex(/^\d{6}$/, "MFA code must be exactly 6 digits"),
    }),
  }),
  verifyMfaLogin: z.object({
    body: z.object({
      token,
      factorId: z.string().min(1, "Factor ID is required").max(FIELD_LIMITS.shortText),
      challengeId: z.string().min(1, "Challenge ID is required").max(FIELD_LIMITS.shortText),
      code: z.string().regex(/^\d{6}$/, "MFA code must be exactly 6 digits"),
    }),
  }),
  verifyMfaRecovery: z.object({
    body: z.object({
      token,
      recoveryCode: z.string().min(8, "Recovery code is required").max(FIELD_LIMITS.shortText),
    }),
  }),
};
