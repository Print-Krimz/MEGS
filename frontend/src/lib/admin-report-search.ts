import type { AnalyticsFilterState } from "./types/analytics.types";
import type { RequestRow } from "./types/analytics.types";

/** Which request rows each chip, count and tile means. One definition, so a count always matches its list. */
export type RequestHealthFilter = "ALL" | "NONE" | "LATE" | "NO_OPENING" | RequestRow["health"];

export const isLateRequest = (r: RequestRow) => r.health === "OVERDUE" || r.health === "AT_RISK";
export const hasNoOpening = (r: RequestRow) => r.attention === "NO_OPENING";
/** No opening posted, or posted but nobody has applied. */
export const hasNoCandidates = (r: RequestRow) => r.attention === "NO_OPENING" || r.attention === "NO_APPLICANTS";

export const matchesRequestHealth = (r: RequestRow, health: RequestHealthFilter): boolean => {
  switch (health) {
    case "ALL":
      return true;
    case "LATE":
      return isLateRequest(r);
    case "NO_OPENING":
      return hasNoOpening(r);
    case "NONE":
      return hasNoCandidates(r);
    default:
      return r.health === health;
  }
};

// Plain checks instead of zod: this file loads with the router, and zod would add ~25 KB gzip to the entry chunk.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const oneOf = <T extends string>(values: readonly T[], v: unknown): T | undefined =>
  values.includes(v as T) ? (v as T) : undefined;
const positiveInt = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
const boundedText = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.length >= 1 && v.length <= max ? v : undefined;
const dateOnly = (v: unknown): string | undefined => (typeof v === "string" && DATE_ONLY.test(v) ? v : undefined);

const RANGES = ["7d", "30d", "90d", "custom"] as const;
const TABS = ["waiting", "requests", "recruiters"] as const;
const HEALTH = ["ALL", "NONE", "LATE", "NO_OPENING", "OVERDUE", "AT_RISK", "ON_TRACK", "FILLED"] as const;
const URGENCY = ["ALL", "critical"] as const;

/** Reports page state kept in the URL. A bad or missing value falls back to the default report. */
export interface AdminReportSearch {
  range?: (typeof RANGES)[number];
  startDate?: string;
  endDate?: string;
  clientId?: number;
  mrfId?: number;
  jobPostingId?: number;
  recruiterId?: string;
  tab?: (typeof TABS)[number];
  health?: (typeof HEALTH)[number];
  urgency?: (typeof URGENCY)[number];
  stage?: string;
}

export const parseAdminReportSearch = (input: unknown): AdminReportSearch => {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const parsed: AdminReportSearch = {
    range: oneOf(RANGES, o.range),
    startDate: dateOnly(o.startDate),
    endDate: dateOnly(o.endDate),
    clientId: positiveInt(o.clientId),
    mrfId: positiveInt(o.mrfId),
    jobPostingId: positiveInt(o.jobPostingId),
    recruiterId: boundedText(o.recruiterId, 100),
    tab: oneOf(TABS, o.tab),
    health: oneOf(HEALTH, o.health),
    urgency: oneOf(URGENCY, o.urgency),
    stage: boundedText(o.stage, 50),
  };
  // Drop undefined keys so the URL stays clean.
  return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined)) as AdminReportSearch;
};

export const searchToFilters = (s: AdminReportSearch): AnalyticsFilterState => {
  const custom = s.range === "custom" && s.startDate && s.endDate;
  return {
    range: custom ? "custom" : s.range && s.range !== "custom" ? s.range : "7d",
    ...(custom ? { startDate: s.startDate, endDate: s.endDate } : {}),
    ...(s.clientId ? { clientId: s.clientId } : {}),
    ...(s.mrfId ? { mrfId: s.mrfId } : {}),
    ...(s.jobPostingId ? { jobPostingId: s.jobPostingId } : {}),
    ...(s.recruiterId ? { recruiterId: s.recruiterId } : {}),
  };
};

export const filtersToSearch = (f: AnalyticsFilterState): Partial<AdminReportSearch> => ({
  range: f.range === "7d" ? undefined : f.range,
  startDate: f.range === "custom" ? f.startDate : undefined,
  endDate: f.range === "custom" ? f.endDate : undefined,
  clientId: f.clientId,
  mrfId: f.mrfId,
  jobPostingId: f.jobPostingId,
  recruiterId: f.recruiterId,
});

/** History state a detail link carries so its back link can return to the same report. */
export const ADMIN_REPORT_STATE_KEY = "adminReport";
export const reportReturnState = (search: AdminReportSearch) => ({ [ADMIN_REPORT_STATE_KEY]: search });
/** Only a well-formed report search is accepted. Anything else returns to the default report. */
export const readReportReturnState = (state: unknown): AdminReportSearch => {
  if (!state || typeof state !== "object") return {};
  return parseAdminReportSearch((state as Record<string, unknown>)[ADMIN_REPORT_STATE_KEY]);
};
