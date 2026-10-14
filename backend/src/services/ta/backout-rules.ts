// Single source of truth for backout rules. Pure functions; no database access.
// The frontend mirrors BACKOUT_REASONS_BY_PARTY in frontend/src/lib/backout.ts.

/** Structured reasons for rejecting or archiving a candidate (the agency or client said no). */
export const REJECTION_REASON_CODES = [
  "QUALIFICATIONS_MISMATCH",
  "FAILED_SCREENING_INTERVIEW",
  "CLIENT_DECLINED",
  "FAILED_FINAL_INTERVIEW",
  "SALARY_EXPECTATION_UNMET",
  "FAILED_COMPLIANCE",
  "OTHER",
] as const;

export const BACKOUT_PARTIES = ["APPLICANT", "CLIENT", "AGENCY"] as const;
export type BackoutPartyValue = (typeof BACKOUT_PARTIES)[number];

export const BACKOUT_REASONS_BY_PARTY: Record<BackoutPartyValue, readonly string[]> = {
  APPLICANT: [
    "NO_SHOW",
    "ACCEPTED_OTHER_OFFER",
    "SALARY_OR_BENEFITS",
    "LOCATION_OR_COMMUTE",
    "FAMILY_OR_PERSONAL",
    "HEALTH",
    "UNREACHABLE",
    "INCOMPLETE_REQUIREMENTS",
    "OTHER",
  ],
  CLIENT: ["CLIENT_CANCELLED_REQUEST", "CLIENT_WITHDREW_SELECTION", "POSITION_FILLED", "OTHER"],
  AGENCY: ["AGENCY_PROCESSING_DELAY", "POSITION_FILLED", "OTHER"],
};

/** Statuses a backout can be recorded from. DEPLOYED is allowed only before the deployment starts. */
export const BACKOUT_ELIGIBLE_STATUSES = [
  "SUBMITTED",
  "PARSING",
  "REVIEW",
  "NEEDS_ATTENTION",
  "MATCHED",
  "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
] as const;

/** Statuses an applicant may withdraw from by themselves (never DEPLOYED: TA cancels the deployment). */
export const APPLICANT_WITHDRAWABLE_STATUSES = BACKOUT_ELIGIBLE_STATUSES.filter((s) => s !== "DEPLOYED");

/** Client and agency can only pull out once the client has seen the candidate. */
const CLIENT_VISIBLE_STAGES = [
  "CLIENT_ENDORSEMENT",
  "FINAL_INTERVIEW",
  "COMPLIANCE",
  "CONTRACT_SIGNING",
  "DEPLOYED",
];

/** Before the client sees the candidate it is a withdrawal; afterwards it is a backout. */
export function backoutKind(stage: string): "WITHDRAWAL" | "BACKOUT" {
  return CLIENT_VISIBLE_STAGES.includes(stage) ? "BACKOUT" : "WITHDRAWAL";
}

export function validateBackoutInput(input: {
  stage: string;
  party: string;
  reason: string;
  occurredAt: Date;
  applicationCreatedAt: Date;
  now?: Date;
}): void {
  const { stage, party, reason, occurredAt, applicationCreatedAt } = input;
  const now = input.now ?? new Date();

  if (!(BACKOUT_ELIGIBLE_STATUSES as readonly string[]).includes(stage)) {
    throw new Error(`A backout cannot be recorded for an application in ${stage}`);
  }
  if (!(BACKOUT_PARTIES as readonly string[]).includes(party)) {
    throw new Error("Invalid responsible party");
  }
  if (!BACKOUT_REASONS_BY_PARTY[party as BackoutPartyValue].includes(reason)) {
    throw new Error(`Reason ${reason} is not valid when the responsible party is ${party}`);
  }
  if (party !== "APPLICANT" && !CLIENT_VISIBLE_STAGES.includes(stage)) {
    throw new Error("Client or agency backouts can only be recorded once the candidate reached client review");
  }
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error("Invalid backout date");
  }
  // 5 minutes of tolerance for clock skew between browser and server.
  if (occurredAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new Error("Backout date cannot be in the future");
  }
  if (occurredAt.getTime() < applicationCreatedAt.getTime()) {
    throw new Error("Backout date cannot be before the application was submitted");
  }
}
