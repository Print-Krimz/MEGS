import { z } from "zod";
import { FIELD_LIMITS } from "./field-limits.js";
import { isPhilippinePhone, normalizeToE164 } from "../utils/sms.js";

const phone = z
  .string()
  .trim()
  .max(32)
  .refine(isPhilippinePhone, "Enter a valid Philippine mobile number (e.g. 09171234567)")
  .transform(normalizeToE164);

const code = z.string().regex(/^\d{6}$/, "Verification code must be exactly 6 numeric digits");
const claimToken = z.string().min(1).max(128);
const email = z.string().trim().max(FIELD_LIMITS.email).email("Enter a valid email address");

// Supabase Auth (bcrypt) only reads the first 72 bytes.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .refine((value) => new TextEncoder().encode(value).length <= FIELD_LIMITS.newPasswordMaxBytes, `Password must be ${FIELD_LIMITS.newPasswordMaxBytes} bytes or fewer.`);

// verifyTurnstile strips turnstileToken from the body before validation, so it is not listed here.
export const claimSchema = {
  start: z.object({ body: z.object({ phone, turnstileToken: z.string().optional() }) }),
  verify: z.object({ body: z.object({ phone, otp: code }) }),
  emailCode: z.object({ body: z.object({ claimToken, email }) }),
  complete: z.object({
    body: z.object({
      claimToken,
      password,
      email: email.optional(),
      emailOtp: code.optional(),
    }),
  }),
};
