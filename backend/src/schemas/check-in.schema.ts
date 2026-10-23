import { z } from "zod";
import { walkInGender } from "./ta.schema.js";
import { FIELD_LIMITS, adultDateOfBirth, boundedIdText, boundedText, finiteNumber, optionalPersonNameSchema } from "./field-limits.js";

const idValue = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
const firstName = z.string().trim().min(1, "First name is required").max(FIELD_LIMITS.name);
const lastName = z.string().trim().min(1, "Last name is required").max(FIELD_LIMITS.name);

export const checkInSchema = {
  // Multipart (optional "file" part handled by multer): every field arrives as a string, which idValue coerces.
  // The CAPTCHA token travels in the x-turnstile-token header; the body copies are tolerated and ignored
  // because verifyTurnstile runs before multer and cannot strip them from a multipart body.
  submit: z.object({
    body: z
      .object({
        turnstileToken: z.string().max(2048).optional(),
        "cf-turnstile-response": z.string().max(2048).optional(),
        jobPostingId: idValue,
        firstName,
        middleName: optionalPersonNameSchema("Middle name"),
        lastName,
        mobileNumber: boundedText(30).optional().nullable(),
        // Required: walk-in applicants must be 18 to 65 years old.
        birthDate: adultDateOfBirth("Applicant", 65),
      })
      .strict(),
  }),
  idParams: z.object({ params: z.object({ id: boundedIdText }).strict() }),
  // Multipart: same fields as taSchema.createWalkIn without jobPostingId (the check-in already names the job).
  confirm: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z
      .object({
        firstName,
        middleName: optionalPersonNameSchema("Middle name"),
        lastName,
        mobileNumber: boundedText(30).optional().nullable(),
        birthDate: adultDateOfBirth("Applicant", 65),
        gender: walkInGender,
        existingUserId: z.string().trim().uuid().optional().or(z.literal("")),
      })
      .strict(),
  }),
  dismiss: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({ reason: z.string().trim().min(1, "Give a reason").max(300) }).strict(),
  }),
};
