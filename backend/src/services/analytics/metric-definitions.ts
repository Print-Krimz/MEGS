// Single source of truth for what the analytics count. Pure functions only.
// Every dashboard number must be built from these definitions so two screens never disagree.

import { manilaDateString } from "../../schemas/field-limits.js";

export type StageRowKey =
  | "APPLIED"
  | "INITIAL_SCREENING"
  | "CLIENT_ENDORSEMENT"
  | "FINAL_INTERVIEW"
  | "COMPLIANCE"
  | "CONTRACT_SIGNING"
  | "DEPLOYED";

export const STAGE_ROWS: { key: StageRowKey; label: string; slaDays: number }[] = [
  { key: "APPLIED", label: "New applications", slaDays: 7 },
  { key: "INITIAL_SCREENING", label: "Initial review", slaDays: 7 },
  { key: "CLIENT_ENDORSEMENT", label: "Client review", slaDays: 5 }, // replaced by Client.reviewThresholdDays
  { key: "FINAL_INTERVIEW", label: "Final interview", slaDays: 5 },
  { key: "COMPLIANCE", label: "Requirements", slaDays: 14 },
  { key: "CONTRACT_SIGNING", label: "Contract signing", slaDays: 7 },
  { key: "DEPLOYED", label: "Awaiting start", slaDays: 7 },
];

const APPLIED_STATUSES = ["SUBMITTED", "PARSING", "REVIEW", "NEEDS_ATTENTION", "MATCHED"];

/** Which table row an application status belongs to. Null for terminal or off-pipeline statuses. */
export function stageRowFor(status: string): StageRowKey | null {
  if (APPLIED_STATUSES.includes(status)) return "APPLIED";
  const row = STAGE_ROWS.find((r) => r.key === status);
  return row ? row.key : null;
}

/** Statuses of applications still moving through the pipeline (excludes DEPLOYED, shown separately). */
export const ACTIVE_PIPELINE_STATUSES = [
  ...APPLIED_STATUSES,
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
];

/** A seat counts as filled while a non-cancelled, non-ended deployment holds it. Matches ta.mrf.service. */
export const FILLED_SEAT_STATUSES = ["READY_FOR_DEPLOYMENT", "ACTIVE", "READY", "DISPATCHED", "PENDING_ORIENTATION"];

/** Stages counted as "the candidate reached client review or later" for backout rate. */
export const POST_SELECTION_STAGES = ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"];

export const DAY_MS = 86_400_000;

export function daysBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Percentage with zero-division safety. */
export const percent = (part: number, whole: number): number => (whole > 0 ? round1((part / whole) * 100) : 0);

/** Monday (Manila calendar) of the week containing `date`, as YYYY-MM-DD. */
export function manilaWeekStart(date: Date): string {
  const key = manilaDateString(date);
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const dow = (utc.getUTCDay() + 6) % 7; // Monday = 0
  utc.setUTCDate(utc.getUTCDate() - dow);
  return utc.toISOString().slice(0, 10);
}

/** The last `count` week starts ending with the current week, oldest first. */
export function recentWeekStarts(count: number, now = new Date()): string[] {
  const current = manilaWeekStart(now);
  const [y, m, d] = current.split("-").map(Number);
  const weeks: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    weeks.push(new Date(Date.UTC(y, m - 1, d - i * 7)).toISOString().slice(0, 10));
  }
  return weeks;
}

/** One application per person per job: keep the latest attempt so returning applicants count once. */
export function latestAttemptOnly<T extends { userId: string; jobPostingId: number; attemptNumber?: number | null; createdAt: Date }>(
  apps: T[]
): T[] {
  const best = new Map<string, T>();
  for (const app of apps) {
    const key = `${app.userId}:${app.jobPostingId}`;
    const current = best.get(key);
    const newer =
      !current ||
      (app.attemptNumber ?? 1) > (current.attemptNumber ?? 1) ||
      ((app.attemptNumber ?? 1) === (current.attemptNumber ?? 1) && app.createdAt > current.createdAt);
    if (newer) best.set(key, app);
  }
  return [...best.values()];
}

export interface DecisionLike {
  fromStatus: string;
  toStatus: string;
  createdAt: Date;
  isReverted?: boolean;
}

/** When the application entered `status`, from the latest non-reverted decision. Falls back to `fallback`. */
export function stageEnteredAt(decisions: DecisionLike[], status: string, fallback: Date): Date {
  let latest: Date | null = null;
  for (const d of decisions) {
    if (d.isReverted || d.toStatus !== status) continue;
    if (!latest || d.createdAt > latest) latest = d.createdAt;
  }
  return latest ?? fallback;
}

/** Stages an application actually reached: current status plus non-reverted destinations. Skipped stages never appear. */
export function stagesReached(status: string, decisions: DecisionLike[]): Set<StageRowKey> {
  const reached = new Set<StageRowKey>(["APPLIED"]);
  const add = (s: string) => {
    const row = stageRowFor(s);
    if (row && row !== "APPLIED") reached.add(row);
  };
  add(status);
  for (const d of decisions) {
    if (!d.isReverted) add(d.toStatus);
  }
  return reached;
}

/** The stage row an application left from when it ended as BACKOUT / REJECTED / ARCHIVED / TALENT_POOL, or null if still active. */
export function exitStageRow(status: string, decisions: DecisionLike[]): StageRowKey | null {
  if (!["BACKOUT", "REJECTED", "ARCHIVED", "TALENT_POOL"].includes(status)) return null;
  let latest: DecisionLike | null = null;
  for (const d of decisions) {
    if (d.isReverted || d.toStatus !== status) continue;
    if (!latest || d.createdAt > latest.createdAt) latest = d;
  }
  return latest ? stageRowFor(latest.fromStatus) : "APPLIED";
}

export type RequestHealth = "FILLED" | "ON_TRACK" | "AT_RISK" | "OVERDUE";

/** Fulfillment health for one manpower request. Boundary rules follow the 2026-10-10 fulfillment design. */
export function requestHealth(input: {
  headcount: number;
  filled: number;
  pipeline: number;
  targetFillDate: Date | null;
  now?: Date;
}): RequestHealth {
  const { headcount, filled, pipeline, targetFillDate } = input;
  const now = input.now ?? new Date();
  if (filled >= headcount) return "FILLED";
  if (!targetFillDate) return "ON_TRACK";
  const daysLeft = (targetFillDate.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft < 0) return "OVERDUE";
  const open = headcount - filled;
  const coverage = open > 0 ? pipeline / open : 1;
  if (daysLeft <= 7 && coverage < 1) return "AT_RISK";
  return "ON_TRACK";
}

/** Whole Manila calendar days from `from` to `to`. Negative when `to` falls on an earlier calendar day. */
export function manilaDayDiff(from: Date, to: Date): number {
  const toUtcDay = (d: Date) => {
    const [y, m, day] = manilaDateString(d).split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toUtcDay(to) - toUtcDay(from)) / DAY_MS);
}

/**
 * When the application entered `status`. `estimated` is true when no stage change was recorded for a stage after the
 * first one, so the age is measured from the application date and may overstate the real time in stage.
 */
export function stageEntry(decisions: DecisionLike[], status: string, fallback: Date): { at: Date; estimated: boolean } {
  let latest: Date | null = null;
  for (const d of decisions) {
    if (d.isReverted || d.toStatus !== status) continue;
    if (!latest || d.createdAt > latest) latest = d.createdAt;
  }
  if (latest) return { at: latest, estimated: false };
  return { at: fallback, estimated: stageRowFor(status) !== "APPLIED" };
}

/** `critical` once the candidate has waited at least twice the stage limit. */
export const urgencyFor = (daysInStage: number, slaDays: number): "critical" | "overdue" =>
  daysInStage >= slaDays * 2 ? "critical" : "overdue";

export type TrendGranularity = "day" | "week" | "month";

/** Chart buckets follow the selected range so short ranges are not one flat bar and long ones are not cluttered. */
export const trendGranularity = (days: number): TrendGranularity => (days <= 14 ? "day" : days <= 120 ? "week" : "month");

export function trendBucketStart(date: Date, granularity: TrendGranularity): string {
  if (granularity === "week") return manilaWeekStart(date);
  const key = manilaDateString(date);
  return granularity === "month" ? `${key.slice(0, 7)}-01` : key;
}

/** Every bucket start from the range start to its end, oldest first. */
export function trendBucketStarts(start: Date, end: Date, granularity: TrendGranularity): string[] {
  const first = trendBucketStart(start, granularity);
  const last = trendBucketStart(end, granularity);
  const out: string[] = [];
  const [y, m, d] = first.split("-").map(Number);
  let cursor = new Date(Date.UTC(y, m - 1, d));
  while (cursor.toISOString().slice(0, 10) <= last && out.length < 400) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor =
      granularity === "month"
        ? new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
        : new Date(cursor.getTime() + (granularity === "week" ? 7 : 1) * DAY_MS);
  }
  return out;
}
