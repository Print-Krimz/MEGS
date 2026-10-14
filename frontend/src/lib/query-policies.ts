import { ApplicationStatus } from "./types/enums";

export const REFERENCE_QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const OPERATIONAL_QUERY_STALE_TIME_MS = 5 * 1000;
export const APPLICATION_PROCESSING_POLL_MS = 5 * 1000;
export const APPLICATION_IDLE_POLL_MS = 30 * 1000;
export const INVITATION_POLL_MS = 60 * 1000;
export const NOTIFICATION_COUNT_POLL_MS = 30 * 1000;
export const SERVER_SEARCH_DEBOUNCE_MS = 300;

export function normalizeServerSearch(value: string): string {
  return value.trim();
}

type ApplicationRecord = {
  status?: unknown;
  aiScore?: unknown;
  candidateFitScore?: unknown;
  resumeAnalysisPending?: unknown;
};

function getApplicationRecords(data: unknown): ApplicationRecord[] {
  if (Array.isArray(data)) return data as ApplicationRecord[];
  if (!data || typeof data !== "object") return [];

  const value = data as { status?: unknown; aiScore?: unknown; candidateFitScore?: unknown; resumeAnalysisPending?: unknown; items?: unknown; applications?: unknown };
  if (Array.isArray(value.items)) return value.items as ApplicationRecord[];
  if (Array.isArray(value.applications)) return value.applications as ApplicationRecord[];
  return [value];
}

export function hasApplicationProcessingWork(data: unknown): boolean {
  return getApplicationRecords(data).some((application) => {
    if (application.status === ApplicationStatus.PARSING) return true;
    if (application.resumeAnalysisPending === true) return true;

    // SUBMITTED remains a short-lived state while resume analysis is queued.
    return application.status === ApplicationStatus.SUBMITTED &&
      ("aiScore" in application || "candidateFitScore" in application) &&
      application.aiScore == null && application.candidateFitScore == null;
  });
}

export function getApplicationRefetchInterval(data: unknown): number {
  return hasApplicationProcessingWork(data)
    ? APPLICATION_PROCESSING_POLL_MS
    : APPLICATION_IDLE_POLL_MS;
}
