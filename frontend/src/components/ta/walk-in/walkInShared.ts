import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { taApi } from "../../../lib/api/ta.api";
import { GENDER_OPTIONS } from "../../../lib/hr-constants";
import { REFERENCE_QUERY_STALE_TIME_MS } from "../../../lib/query-policies";
import { validatePhilippineMobile } from "../../../lib/phone-utils";
import { MAX_AGE, MIN_AGE } from "../../../lib/walk-in-age";
import { validateDateOfBirth } from "../../../lib/statutory-validation";
import type { WalkInBiodataRead } from "../../../lib/types/application.types";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const ACCEPT_ATTRIBUTE = "image/jpeg,image/png,image/webp,application/pdf";
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const FILE_TOO_BIG_MESSAGE = "The file is over 5 MB. Retake the photo or use a smaller file.";
export const FILE_TYPE_MESSAGE = "Use a JPEG, PNG or WEBP photo, or a PDF.";
export const UNREADABLE_MESSAGE = "Couldn't read this file. Type the details.";

export const GENDER_SELECT_OPTIONS = GENDER_OPTIONS.map((value) => ({ value, label: value }));

/** The identity fields every walk-in needs, whether it is encoded alone or in a batch. */
export const walkInIdentitySchema = z.object({
  jobPostingId: z.string().min(1, "Choose a job opening."),
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
  lastName: z.string().trim().min(1, "Enter a last name.").max(100),
  middleName: z.string().trim().max(100),
  mobileNumber: z.string().refine((v) => validatePhilippineMobile(v).isValid, "Enter an 11-digit mobile number starting with 09."),
  birthDate: z.string().superRefine((v, ctx) => {
    if (!v) {
      ctx.addIssue({ code: "custom", message: "Enter the birth date." });
      return;
    }
    if (validateDateOfBirth(v, { minAge: MIN_AGE, maxAge: MAX_AGE })) {
      ctx.addIssue({ code: "custom", message: `Applicant must be ${MIN_AGE} to ${MAX_AGE} years old.` });
    }
  }),
  gender: z.string().refine((v) => (GENDER_OPTIONS as readonly string[]).includes(v), "Choose a gender."),
});

export const fileSchema = z
  .instanceof(File)
  .optional()
  .refine((f) => !f || f.size <= MAX_FILE_BYTES, FILE_TOO_BIG_MESSAGE)
  .refine((f) => !f || ACCEPTED_TYPES.includes(f.type), FILE_TYPE_MESSAGE);

export interface IdentityFields {
  firstName: string;
  middleName: string;
  lastName: string;
  mobileNumber: string;
  birthDate: string;
  gender: string;
}

export interface BiodataFill<T extends IdentityFields> {
  /** The values with every empty field filled from the bio-data. Typed values are never replaced. */
  next: T;
  /** True when at least one field changed. */
  filled: boolean;
}

/** Fills only the empty identity fields from a bio-data read. */
export function fillEmptyFields<T extends IdentityFields>(current: T, read: WalkInBiodataRead): BiodataFill<T> {
  const next = { ...current };
  let filled = false;
  const take = (key: keyof IdentityFields, value: string | undefined) => {
    if (!value || next[key].trim()) return;
    next[key] = value as T[keyof IdentityFields];
    filled = true;
  };
  take("firstName", read.firstName?.trim());
  take("middleName", read.middleName?.trim());
  take("lastName", read.lastName?.trim());
  if (read.mobileNumber && validatePhilippineMobile(read.mobileNumber).isComplete) take("mobileNumber", read.mobileNumber);
  if (read.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(read.birthDate)) take("birthDate", read.birthDate);
  if (read.gender && (GENDER_OPTIONS as readonly string[]).includes(read.gender)) take("gender", read.gender);
  return { next, filled };
}

export interface DuplicateParams {
  phone?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
}

/** What to ask the server when looking for an existing person. Null when there is not enough to look with. */
export function duplicateParamsFor(values: IdentityFields): DuplicateParams | null {
  const phoneOk = Boolean(values.mobileNumber) && validatePhilippineMobile(values.mobileNumber).isComplete;
  const nameOk = Boolean(values.firstName.trim() && values.lastName.trim());
  if (!phoneOk && !nameOk) return null;
  return {
    phone: phoneOk ? values.mobileNumber : undefined,
    firstName: nameOk ? values.firstName.trim() : undefined,
    lastName: nameOk ? values.lastName.trim() : undefined,
    birthDate: values.birthDate || undefined,
  };
}

/** The TA's open jobs, as combobox options. */
export function useOpenJobOptions(enabled: boolean) {
  const jobsQuery = useQuery({
    queryKey: ["ta", "jobs", "dropdown"],
    queryFn: ({ signal }) => taApi.listJobs({}, { signal }),
    staleTime: REFERENCE_QUERY_STALE_TIME_MS,
    enabled,
  });

  const jobOptions = useMemo(
    () =>
      (jobsQuery.data ?? [])
        .filter((job) => job.status === "OPEN")
        .map((job) => ({
          value: String(job.id),
          label: job.title,
          subtitle: [job.mrf?.client?.name, job.location].filter(Boolean).join(" · ") || undefined,
        })),
    [jobsQuery.data],
  );

  return { jobsQuery, jobOptions };
}
