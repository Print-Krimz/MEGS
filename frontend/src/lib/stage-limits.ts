import { ApplicationStatus } from "./types/enums";

/**
 * Days a candidate may wait in a stage before it counts as overdue. Mirrors STAGE_ROWS in
 * backend/src/services/analytics/metric-definitions.ts so the queue and the reports agree.
 * Client review uses the per-client threshold on the backend; 5 days is its default.
 */
const STAGE_LIMIT_DAYS: Partial<Record<ApplicationStatus, number>> = {
  [ApplicationStatus.SUBMITTED]: 7,
  [ApplicationStatus.PARSING]: 7,
  [ApplicationStatus.REVIEW]: 7,
  [ApplicationStatus.MATCHED]: 7,
  [ApplicationStatus.NEEDS_ATTENTION]: 7,
  [ApplicationStatus.INITIAL_SCREENING]: 7,
  [ApplicationStatus.CLIENT_ENDORSEMENT]: 5,
  [ApplicationStatus.FINAL_INTERVIEW]: 5,
  [ApplicationStatus.COMPLIANCE]: 14,
  [ApplicationStatus.CONTRACT_SIGNING]: 7,
};

export type StageHealth = "onTrack" | "overdue";

/** Null for stages with no limit (closed, deployed, pool) or when the day count is unknown. */
export function stageHealth(status: ApplicationStatus | string, daysInStage?: number | null): StageHealth | null {
  const limit = STAGE_LIMIT_DAYS[status as ApplicationStatus];
  if (limit == null || daysInStage == null) return null;
  return daysInStage > limit ? "overdue" : "onTrack";
}

export function stageLimitDays(status: ApplicationStatus | string): number | undefined {
  return STAGE_LIMIT_DAYS[status as ApplicationStatus];
}
