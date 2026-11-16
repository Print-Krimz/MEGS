import type { ApplicationSource } from "./types/application.types";

export const APPLICATION_SOURCE_LABELS: Record<ApplicationSource, string> = {
  ONLINE: "MEGS portal",
  WALK_IN: "Walk-in",
  LINKEDIN: "LinkedIn",
  JOBSTREET: "JobStreet",
  BOSSJOB: "Bossjob",
  FACEBOOK: "Facebook",
  EMAIL: "Email",
  REFERRAL: "Referral",
  OTHER: "Other",
};

/** Sources a TA can record. ONLINE is only set when the applicant applies on the portal. */
export const STAFF_SOURCES: ApplicationSource[] = ["WALK_IN", "LINKEDIN", "JOBSTREET", "BOSSJOB", "FACEBOOK", "EMAIL", "REFERRAL", "OTHER"];
export const ALL_SOURCES: ApplicationSource[] = ["ONLINE", ...STAFF_SOURCES];
export const STAFF_SOURCE_OPTIONS = STAFF_SOURCES.map((value) => ({ value, label: APPLICATION_SOURCE_LABELS[value] }));
export const isApplicationSource = (value: unknown): value is ApplicationSource => ALL_SOURCES.includes(value as ApplicationSource);
/** Sources that take a short free-text detail. */
export const SOURCE_DETAIL_LABELS: Partial<Record<ApplicationSource, string>> = { REFERRAL: "Referred by", OTHER: "Platform or channel" };
