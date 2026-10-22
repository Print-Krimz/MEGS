import { z } from "zod";
import { FIELD_LIMITS, adultDateOfBirth, boundedIdText, boundedText, finiteNumber, optionalPersonNameSchema } from "./field-limits.js";

const idValue = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
const firstName = z.string().trim().min(1, "First name is required").max(FIELD_LIMITS.name);
const lastName = z.string().trim().min(1, "Last name is required").max(FIELD_LIMITS.name);

export const checkInSchema = {
  // verifyTurnstile strips turnstileToken from the body before this runs.
  submit: z.object({
    body: z
      .object({
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
        existingUserId: z.string().trim().uuid().optional().or(z.literal("")),
      })
      .strict(),
  }),
  dismiss: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({ reason: z.string().trim().min(1, "Give a reason").max(300) }).strict(),
  }),
};
