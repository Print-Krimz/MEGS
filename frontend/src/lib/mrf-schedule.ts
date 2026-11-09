// Labels and helpers for the paper-form fields on a manpower request: department, work schedule and reason.
// The allowed values mirror backend/src/schemas/mrf-paper-fields.ts.

export const WORK_SHIFTS = ["DAY", "NIGHT", "MID", "ROTATING", "FLEXIBLE"] as const;
export const WORK_DAYS = ["MON_FRI", "MON_SAT", "SIX_DAYS_ROTATING", "COMPRESSED_4"] as const;
export const WORK_HOURS = [8, 10, 12] as const;
export const REQUEST_REASONS = ["ADDITIONAL", "NEW_POSITION", "REPLACEMENT"] as const;

export type WorkShift = (typeof WORK_SHIFTS)[number];
export type WorkDays = (typeof WORK_DAYS)[number];
export type WorkHours = (typeof WORK_HOURS)[number];
export type RequestReason = (typeof REQUEST_REASONS)[number];

export const WORK_SHIFT_LABELS: Record<WorkShift, string> = {
  DAY: "Day shift",
  NIGHT: "Night shift",
  MID: "Mid shift",
  ROTATING: "Rotating shift",
  FLEXIBLE: "Flexible",
};

export const WORK_DAYS_LABELS: Record<WorkDays, string> = {
  MON_FRI: "Monday to Friday",
  MON_SAT: "Monday to Saturday",
  SIX_DAYS_ROTATING: "6 days, rotating rest day",
  COMPRESSED_4: "Compressed, 4 days",
};

export const REQUEST_REASON_LABELS: Record<RequestReason, string> = {
  ADDITIONAL: "Additional manpower",
  NEW_POSITION: "New position",
  REPLACEMENT: "Replacement",
};

export const workHoursLabel = (hours: number) => `${hours} hours`;

/** Common departments offered as suggestions. The field still accepts any text. */
export const DEPARTMENT_SUGGESTIONS = [
  "Production", "Operations", "Warehouse", "Logistics", "Quality Control", "Maintenance",
  "Packaging", "Sales", "Admin", "Housekeeping", "Security",
] as const;

interface ScheduleSource {
  workShift?: string | null;
  workDays?: string | null;
  workHoursPerDay?: number | null;
  workTime?: string | null;
}

const labelOf = <T extends string>(labels: Record<T, string>, key: string | null | undefined): string | null =>
  key && key in labels ? labels[key as T] : null;

/** One readable line, for example "Day shift · Monday to Saturday · 8 hours (7:00 AM - 4:00 PM)". Null when nothing is set. */
export const formatWorkSchedule = (source: ScheduleSource): string | null => {
  const parts = [
    labelOf(WORK_SHIFT_LABELS, source.workShift),
    labelOf(WORK_DAYS_LABELS, source.workDays),
    source.workHoursPerDay ? workHoursLabel(source.workHoursPerDay) : null,
  ].filter((part): part is string => Boolean(part));
  const time = source.workTime?.trim();
  if (parts.length === 0) return time || null;
  return time ? `${parts.join(" · ")} (${time})` : parts.join(" · ");
};

/** "Replacement · 2 operators resigned", or just the reason label when there is no note. */
export const formatRequestReason = (reason?: string | null, note?: string | null): string | null => {
  const label = labelOf(REQUEST_REASON_LABELS, reason);
  const text = note?.trim();
  if (label && text) return `${label} · ${text}`;
  return label || text || null;
};

const COMPANY_SUFFIXES = new Set(["inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited", "llc"]);

/** Lowercase, no punctuation, no Inc/Corp/Co style endings, so "Crestline Assembly Mfg. Inc." and "crestline assembly mfg" compare equal. */
export const normalizeCompanyName = (name: string): string => {
  const words = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
};

/** The one client whose name or brand name equals the company on the form, or null when none or several match. */
export const matchClientByCompany = <T extends { id: number; name: string; tradeName?: string | null }>(
  clients: readonly T[],
  company: string | null | undefined,
): T | null => {
  const wanted = company ? normalizeCompanyName(company) : "";
  if (!wanted) return null;
  const hits = clients.filter(
    (client) =>
      normalizeCompanyName(client.name) === wanted ||
      (client.tradeName ? normalizeCompanyName(client.tradeName) === wanted : false),
  );
  return hits.length === 1 ? hits[0] : null;
};
