// Single source of truth for recruitment pipeline stage rules.
// The frontend copy (frontend/src/lib/types/enums.ts) is kept in sync by
// backend/src/__tests__/pipeline-rules.test.ts.

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED:                 ["PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION", "BACKOUT", "ARCHIVED", "REJECTED"],
  PARSING:                   ["REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION", "BACKOUT", "ARCHIVED", "REJECTED"],
  REVIEW:                    ["INITIAL_SCREENING", "MATCHED", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  NEEDS_ATTENTION:           ["PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  MATCHED:                   ["INITIAL_SCREENING", "REVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  TALENT_POOL:               ["ARCHIVED", "REJECTED"],
  INITIAL_SCREENING:         ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  CLIENT_ENDORSEMENT:        ["FINAL_INTERVIEW", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  FINAL_INTERVIEW:           ["COMPLIANCE", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  COMPLIANCE:                ["CONTRACT_SIGNING", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  CONTRACT_SIGNING: ["DEPLOYED", "TALENT_POOL", "BACKOUT", "ARCHIVED", "REJECTED"],
  DEPLOYED:                  ["BACKOUT", "ARCHIVED", "REJECTED"], // BACKOUT only while the deployment has not started (see backout.service.ts)
  BACKOUT:                   [],
  REJECTED:                  [],
  ARCHIVED:                  [],
};

/** Ordered main pipeline. Only stages in SKIPPABLE_STAGES may be bypassed. */
export const PIPELINE_STAGE_ORDER = [
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
] as const;

/**
 * Only Client review may be skipped (Initial review -> Final interview), with a recorded reason.
 * Final interview, Requirements, Contract Signing and Deployment are never skippable;
 * redeployed / same-client candidates reach Requirements through the Fast Track workflow instead.
 */
export const SKIPPABLE_STAGES: readonly string[] = ["CLIENT_ENDORSEMENT"];

export type TransitionType = "NORMAL" | "SKIP" | "FAST_TRACK";

/** Stages strictly between `from` and `to` on the main pipeline (empty if either is off-pipeline). */
export function stagesBetween(from: string, to: string): string[] {
  const order = PIPELINE_STAGE_ORDER as readonly string[];
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0 || b - a < 2) return [];
  return order.slice(a + 1, b) as string[];
}
