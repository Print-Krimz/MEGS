import { z } from "zod";
import { isCodeOrScript } from "./statutory-validation";

type NameUser = {
  role?: string | null;
  displayName?: string | null;
  email?: string | null;
  applicantProfile?: { firstName?: string | null; lastName?: string | null } | null;
} | null | undefined;

export const resolveUserName = (user: NameUser, fallback = "Unknown"): string => {
  const profile = [user?.applicantProfile?.firstName?.trim(), user?.applicantProfile?.lastName?.trim()]
    .filter(Boolean).join(" ");
  return (user?.role !== "APPLICANT" && user?.displayName?.trim()) || profile || user?.email?.trim() || fallback;
};


export const DISPLAY_NAME_MAX_LENGTH = 201;
export const staffDisplayNameSchema = z.string()
  .refine((value) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value), "Full name contains control characters")
  .transform((value) => value.trim())
  .pipe(z.string()
    .min(1, "Full name is required")
    .max(DISPLAY_NAME_MAX_LENGTH)
    .refine((value) => !/[{}<>;=`~$^*|\\]/.test(value), "Full name contains invalid characters")
    .refine((value) => !isCodeOrScript(value), "Full name cannot contain programming code or scripts"));
