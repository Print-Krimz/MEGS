// Frontend mirror of backend/src/services/ta/backout-rules.ts (reasons per responsible party).
import { ALLOWED_STAGE_TRANSITIONS, ApplicationStatus } from "./types/enums";

export type BackoutParty = "APPLICANT" | "CLIENT" | "AGENCY";

export const BACKOUT_PARTY_LABELS: Record<BackoutParty, string> = {
  APPLICANT: "Applicant",
  CLIENT: "Client",
  AGENCY: "MEGS (agency)",
};

export const BACKOUT_REASON_LABELS: Record<string, string> = {
  NO_SHOW: "Did not show up",
  ACCEPTED_OTHER_OFFER: "Accepted another job offer",
  SALARY_OR_BENEFITS: "Salary or benefits",
  LOCATION_OR_COMMUTE: "Work location or commute",
  FAMILY_OR_PERSONAL: "Family or personal reasons",
  HEALTH: "Health reasons",
  UNREACHABLE: "Cannot be reached",
  INCOMPLETE_REQUIREMENTS: "Could not complete requirements",
  CLIENT_CANCELLED_REQUEST: "Client cancelled the request",
  CLIENT_WITHDREW_SELECTION: "Client withdrew the selection",
  POSITION_FILLED: "Position already filled",
  AGENCY_PROCESSING_DELAY: "Processing delay on our side",
  OTHER: "Other reason",
};

export const BACKOUT_REASONS_BY_PARTY: Record<BackoutParty, string[]> = {
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

/** Reasons an applicant can give when withdrawing themselves (no "did not show up" or "cannot be reached"). */
export const APPLICANT_SELF_REASONS = BACKOUT_REASONS_BY_PARTY.APPLICANT.filter(
  (r) => r !== "NO_SHOW" && r !== "UNREACHABLE",
);

const CLIENT_VISIBLE = ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"];

/** Client and agency can only pull out once the client has seen the candidate. */
export const partiesForStatus = (status: string): BackoutParty[] =>
  CLIENT_VISIBLE.includes(status) ? ["APPLICANT", "CLIENT", "AGENCY"] : ["APPLICANT"];

const BACKOUT_ELIGIBLE = [
  "SUBMITTED", "PARSING", "REVIEW", "NEEDS_ATTENTION", "MATCHED", "INITIAL_SCREENING",
  "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED",
];

/** DEPLOYED qualifies only while no deployment has started. */
export const canRecordBackout = (status: string, deploymentStatuses: string[] = []): boolean => {
  if (!BACKOUT_ELIGIBLE.includes(status)) return false;
  if (status === "DEPLOYED") {
    return deploymentStatuses.includes("READY_FOR_DEPLOYMENT") && !deploymentStatuses.includes("ACTIVE");
  }
  return true;
};

export const canApplicantWithdraw = (status: string): boolean =>
  status !== "DEPLOYED" && BACKOUT_ELIGIBLE.includes(status);

/** Talent Pool is offered only from stages that may move to it. Source: ALLOWED_STAGE_TRANSITIONS (mirrors backend pipeline-rules.ts). */
export const canKeepInTalentPool = (status: string): boolean => {
  const next: readonly string[] = ALLOWED_STAGE_TRANSITIONS[status] ?? [];
  return next.includes(ApplicationStatus.TALENT_POOL);
};

export type ClosureOutcome = "REJECTED" | "BACKED_OUT";
export type ClosureDisposition = "TALENT_POOL" | "ARCHIVE";

/** Reasons for rejecting an applicant. Mirrors REJECTION_REASON_CODES in backend/src/services/ta/backout-rules.ts. */
export const REJECTION_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "QUALIFICATIONS_MISMATCH", label: "Skills or qualifications do not match" },
  { value: "FAILED_SCREENING_INTERVIEW", label: "Did not pass initial interview" },
  { value: "CLIENT_DECLINED", label: "Client declined" },
  { value: "FAILED_FINAL_INTERVIEW", label: "Did not pass final interview" },
  { value: "SALARY_EXPECTATION_UNMET", label: "Salary expectations did not match" },
  { value: "FAILED_COMPLIANCE", label: "Requirements could not be verified" },
  { value: "CLIENT_CANCELLED_REQUEST", label: "Client cancelled the request" },
  { value: "CLIENT_WITHDREW_SELECTION", label: "Client withdrew the selection" },
  { value: "POSITION_FILLED", label: "Position was filled" },
  { value: "OTHER", label: "Other reason" },
];

export const REJECTION_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REJECTION_REASON_OPTIONS.map((o) => [o.value, o.label]),
);

export const CLOSURE_OUTCOME_LABELS: Record<ClosureOutcome, string> = { REJECTED: "Rejected", BACKED_OUT: "Backed out" };
export const CLOSURE_DISPOSITION_LABELS: Record<ClosureDisposition, string> = { TALENT_POOL: "Talent pool", ARCHIVE: "Archived" };

/** Label for a closure reason, whichever list it came from. */
export const closureReasonLabel = (code: string): string =>
  REJECTION_REASON_LABELS[code] ?? BACKOUT_REASON_LABELS[code] ?? code;

export interface ApplicationClosureRecord {
  outcome: ClosureOutcome;
  disposition: ClosureDisposition | null;
  stage: string;
  reasonCode: string;
  notes?: string | null;
  occurredAt: string;
}

export interface ApplicationBackoutRecord {
  stage: string;
  party: BackoutParty;
  reason: string;
  notes?: string | null;
  occurredAt: string;
}

/** Archive-dialog presets mapped to the structured reason codes the server stores. */
export const REJECTION_REASON_CODE_BY_PRESET: Record<string, string> = {
  "Qualifications Mismatch": "QUALIFICATIONS_MISMATCH",
  "Failed Screening Interview": "FAILED_SCREENING_INTERVIEW",
  "Client Declined Endorsement": "CLIENT_DECLINED",
  "Failed Final Interview": "FAILED_FINAL_INTERVIEW",
  "Salary Expectation Unmet": "SALARY_EXPECTATION_UNMET",
  "Failed Compliance Verification": "FAILED_COMPLIANCE",
  "Client Cancelled Request": "CLIENT_CANCELLED_REQUEST",
  "Client Withdrew Selection": "CLIENT_WITHDREW_SELECTION",
  "Position Filled": "POSITION_FILLED",
  "Other / Discretionary": "OTHER",
};
