/** Most records a single bulk request may touch. Rows run one after another, so this also bounds the request time. */
export const BULK_MAX_IDS = 50;

/**
 * Stages a recruiter may move many applications into at once. Later stages are gated by evidence that is
 * recorded per candidate (passed interviews, endorsements, documents, signed contract), so they stay one by one.
 */
export const BULK_MOVE_TARGETS = ["INITIAL_SCREENING"] as const;
export type BulkMoveTarget = (typeof BULK_MOVE_TARGETS)[number];
