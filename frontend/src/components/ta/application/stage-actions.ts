import type { Application } from "../../../lib/types";
import { ApplicationStatus } from "../../../lib/types/enums";
import { canRecordBackout } from "../../../lib/backout";
import { REQUIREMENTS_ONWARD } from "./tabs";

/**
 * Pure stage rules for the TA application record.
 * Every rule here was moved unchanged from ApplicationDetailPage; do not loosen them (they mirror the backend gates).
 */

type Interviews = NonNullable<Application["interviews"]>;
type Interview = Interviews[number];

const isPassed = (i: Interview) => i.result === "PASS" || i.result === "PASSED";
const isOpen = (i: Interview) => !i.result || i.result === "PENDING" || i.result === "SCHEDULED";

const PRE_SCREENING_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.PARSING,
  ApplicationStatus.REVIEW,
  ApplicationStatus.MATCHED,
  ApplicationStatus.NEEDS_ATTENTION,
  ApplicationStatus.INITIAL_SCREENING,
];

/** Client decisions are recorded only at Client review and Final interview; the backend refuses them after that. */
const CLIENT_DECISION_CLOSED: ApplicationStatus[] = [
  ApplicationStatus.BACKOUT,
  ApplicationStatus.REJECTED,
  ApplicationStatus.ARCHIVED,
  ApplicationStatus.COMPLIANCE,
  ApplicationStatus.CONTRACT_SIGNING,
  ApplicationStatus.DEPLOYED,
];

export type ApplicationFlags = ReturnType<typeof deriveApplicationFlags>;

export function deriveApplicationFlags(app: Application) {
  const interviews = app.interviews || [];
  const requirements = app.complianceRequirements || [];
  const active = (i: Interview) => i.isActive !== false;

  const latestEndorsement = app.clientEndorsements && app.clientEndorsements.length > 0 ? app.clientEndorsements[0] : null;

  const hasPassedScreening = interviews.some((i) => i.type === "INITIAL_SCREENING" && isPassed(i) && active(i));
  const pendingScreeningInterview = interviews.find((i) => i.type === "INITIAL_SCREENING" && isOpen(i) && active(i));
  const hasPassedFinalInterview = interviews.some((i) => i.type === "FINAL_INTERVIEW" && isPassed(i) && active(i));
  const pendingFinalInterview = interviews.find((i) => i.type === "FINAL_INTERVIEW" && isOpen(i) && active(i));

  const isPendingClientReview = latestEndorsement?.outcome === "PENDING";
  const isClientDeclined = latestEndorsement?.outcome === "DECLINED";
  const isClientApproved = latestEndorsement?.outcome === "APPROVED" || latestEndorsement?.outcome === "ENDORSED";

  const hasUnapprovedMandatoryCompliance = requirements.some(
    (c) => c.isRequired && c.reviewStatus !== "APPROVED" && c.reviewStatus !== "TO_FOLLOW"
  );

  const isTerminal =
    app.status === ApplicationStatus.ARCHIVED ||
    app.status === ApplicationStatus.BACKOUT ||
    app.status === ApplicationStatus.REJECTED ||
    app.status === ApplicationStatus.DEPLOYED;
  // Requirements are managed only from the Requirements stage onward (mirrors the backend gate).
  const canManageRequirements = REQUIREMENTS_ONWARD.includes(app.status);
  const canReject = !isTerminal;
  const canBackout =
    !app.isArchived && canRecordBackout(app.status, (app.deployments || []).map((d) => d.status));

  const isPreScreeningOrScreening = PRE_SCREENING_STATUSES.includes(app.status);

  const canScheduleInitialInterview =
    isPreScreeningOrScreening && !hasPassedScreening && !pendingScreeningInterview && !isTerminal;
  const canRecordInitialInterview = isPreScreeningOrScreening && Boolean(pendingScreeningInterview) && !isTerminal;
  const canAdvanceToClientEndorsement =
    hasPassedScreening && (app.status === ApplicationStatus.INITIAL_SCREENING || isPreScreeningOrScreening) && !isTerminal;

  const isClientEndorsementStage = app.status === ApplicationStatus.CLIENT_ENDORSEMENT;
  const isFinalInterviewStage = app.status === ApplicationStatus.FINAL_INTERVIEW;
  const canScheduleFinalInterview = isFinalInterviewStage && !hasPassedFinalInterview && !pendingFinalInterview && !isTerminal;
  const canRecordFinalInterview =
    isFinalInterviewStage && !hasPassedFinalInterview && Boolean(pendingFinalInterview) && !isTerminal;
  const canAdvanceToCompliance = isFinalInterviewStage && hasPassedFinalInterview && !isTerminal;
  // A passed interview completes its stage: no further interview of that type can be scheduled.
  const canScheduleFinalFromClientReview =
    isClientEndorsementStage &&
    hasPassedScreening &&
    !hasPassedFinalInterview &&
    !pendingFinalInterview &&
    !isClientDeclined &&
    !isTerminal;

  // Redeployment Fast Track: returning workers can skip straight to Requirements/Final interview (backend re-validates).
  const isCandidateEligibleForRedeployment = Boolean(
    app.isRedeploymentEligible ||
      app.user?.employee?.status === "AVAILABLE_FOR_REDEPLOYMENT" ||
      (app.user?.employee?.deployments && app.user.employee.deployments.length > 0)
  );
  const canFastTrackRedeployment = isPreScreeningOrScreening && isCandidateEligibleForRedeployment && !isTerminal;

  const nextSchedulableInterview: "INITIAL_SCREENING" | "FINAL_INTERVIEW" | null = canScheduleInitialInterview
    ? "INITIAL_SCREENING"
    : canScheduleFinalInterview || canScheduleFinalFromClientReview
    ? "FINAL_INTERVIEW"
    : null;

  const isComplianceStage = app.status === ApplicationStatus.COMPLIANCE;
  const canAdvanceToContractSigning = isComplianceStage && !hasUnapprovedMandatoryCompliance && !isTerminal;

  const isContractSigningStage =
    app.status === ApplicationStatus.CONTRACT_SIGNING ||
    app.status === ApplicationStatus.ONBOARDING ||
    (app.status as string) === "ONBOARDING" ||
    (app.status as string) === "HIRED";
  const isContractSigned = Boolean(app.contractSigned || app.contractSignedAt);
  const isReadyForDeployment = !isTerminal && !hasUnapprovedMandatoryCompliance && isContractSigned;
  // Any scheduled/active deployment for this worker (from this or another application) blocks a new one.
  const openDeployment =
    [...(app.deployments || []), ...(app.user?.employee?.deployments || [])].find(
      (deployment) => !["ENDED", "CANCELLED"].includes(String(deployment.status))
    ) ?? null;
  const canDeployCandidate = isReadyForDeployment && !openDeployment;

  const total = requirements.length;
  const approved = requirements.filter((r) => r.reviewStatus === "APPROVED").length;
  const toFollow = requirements.filter((r) => r.reviewStatus === "TO_FOLLOW").length;
  const submitted = requirements.filter((r) => r.reviewStatus === "SUBMITTED").length;
  const missing = requirements.filter((r) => !r.documentId && r.reviewStatus !== "APPROVED" && r.reviewStatus !== "TO_FOLLOW").length;
  const isAllClearancesApproved = total > 0 && approved + toFollow === total;

  const isPastClientReview = !isPreScreeningOrScreening && app.status !== ApplicationStatus.CLIENT_ENDORSEMENT;
  const canRecordClientReview = !CLIENT_DECISION_CLOSED.includes(app.status as ApplicationStatus);

  return {
    latestEndorsement,
    hasPassedScreening,
    pendingScreeningInterview,
    hasPassedFinalInterview,
    pendingFinalInterview,
    isPendingClientReview,
    isClientDeclined,
    isClientApproved,
    hasUnapprovedMandatoryCompliance,
    isTerminal,
    canManageRequirements,
    canReject,
    canBackout,
    isPreScreeningOrScreening,
    canScheduleInitialInterview,
    canRecordInitialInterview,
    canAdvanceToClientEndorsement,
    isClientEndorsementStage,
    isFinalInterviewStage,
    canScheduleFinalInterview,
    canRecordFinalInterview,
    canAdvanceToCompliance,
    canScheduleFinalFromClientReview,
    canFastTrackRedeployment,
    nextSchedulableInterview,
    isComplianceStage,
    canAdvanceToContractSigning,
    isContractSigningStage,
    isContractSigned,
    isReadyForDeployment,
    openDeployment,
    canDeployCandidate,
    totalCompReqs: total,
    approvedCompReqs: approved,
    toFollowCompReqs: toFollow,
    submittedCompReqs: submitted,
    missingCompReqs: missing,
    isAllClearancesApproved,
    isPastClientReview,
    canRecordClientReview,
  };
}

/** Which handler the page runs. The id is also the handler key. */
export type StageActionId =
  | "schedule-initial"
  | "record-initial-outcome"
  | "reschedule-initial"
  | "send-to-client"
  | "skip-to-final"
  | "fast-track"
  | "record-client-decision"
  | "update-client-decision"
  | "schedule-final"
  | "record-final-outcome"
  | "reschedule-final"
  | "move-to-requirements"
  | "move-to-contract-signing"
  | "upload-contract"
  | "activate-deployment"
  | "manage-contract-signing"
  | "requirements-pending";

export interface StageAction {
  id: StageActionId;
  label: string;
  /** "status" is a read-only note, not a button. */
  kind: "primary" | "secondary" | "status";
}

export interface StageActionOptions {
  /**
   * The old header hid the deploy / manage-contract buttons while the requirements tab was open
   * (the tab had its own copy). The sticky stage bar is always visible, so it passes false.
   */
  onRequirementsTab?: boolean;
}

/**
 * The stage actions the old header showed, in the same order, with the same labels.
 * Kept as the single source for the stage bar; pickStageBarActions trims it to one primary and one secondary.
 */
export function getStageActions(
  _app: Application,
  flags: ApplicationFlags,
  options: StageActionOptions = {}
): StageAction[] {
  const { onRequirementsTab = false } = options;
  const out: StageAction[] = [];
  const add = (id: StageActionId, label: string, kind: StageAction["kind"]) => out.push({ id, label, kind });

  if (flags.canScheduleInitialInterview) add("schedule-initial", "Schedule interview", "primary");
  if (flags.canRecordInitialInterview) {
    add("record-initial-outcome", "Record screening outcome", "primary");
    add("reschedule-initial", "Reschedule", "secondary");
  }
  if (flags.canAdvanceToClientEndorsement) {
    add("send-to-client", "Send to client", "primary");
    add("skip-to-final", "Skip to final interview", "secondary");
  }
  if (flags.canFastTrackRedeployment) add("fast-track", "Fast-track redeployment", "secondary");

  if (flags.isClientEndorsementStage) {
    if (!flags.latestEndorsement) add("send-to-client", "Send to client", "primary");
    if (flags.latestEndorsement && flags.isPendingClientReview) add("record-client-decision", "Record client decision", "primary");
    if (flags.latestEndorsement && (flags.isClientApproved || flags.isClientDeclined)) {
      add("update-client-decision", "Update client decision", "secondary");
    }
  }

  if (flags.canScheduleFinalInterview) {
    add("schedule-final", "Schedule final interview", "primary");
    add("record-final-outcome", "Record client interview outcome", "secondary");
  }
  if (flags.canRecordFinalInterview) {
    add("record-final-outcome", "Record client interview outcome", "primary");
    add("reschedule-final", "Reschedule", "secondary");
  }
  if (flags.canAdvanceToCompliance) add("move-to-requirements", "Move to requirements", "primary");

  if (flags.isComplianceStage) {
    if (flags.canAdvanceToContractSigning) add("move-to-contract-signing", "Move to contract signing", "primary");
    else add("requirements-pending", "Required items still pending", "status");
  }

  if (flags.isContractSigningStage) {
    if (flags.canDeployCandidate && !onRequirementsTab) add("activate-deployment", "Activate deployment", "primary");
    if (!flags.isReadyForDeployment && !onRequirementsTab) add("manage-contract-signing", "Manage contract signing", "secondary");
  }
  return out;
}

/**
 * What the sticky stage bar shows: exactly one primary and at most one secondary; the rest go to the More menu.
 * Extra rules over getStageActions:
 *  - Contract signing with no signed copy yet: "Upload signed contract" is the primary (the old header only offered
 *    "Manage contract signing", while the real action sat on the second tab).
 *  - Client review approved: "Schedule final interview" is the primary (it used to live only in the interview list).
 */
export function pickStageBarActions(
  app: Application,
  flags: ApplicationFlags
): { primary: StageAction | null; secondary: StageAction | null; overflow: StageAction[] } {
  let actions = getStageActions(app, flags, { onRequirementsTab: false }).filter((a) => a.kind !== "status");

  if (flags.isContractSigningStage && !flags.isContractSigned && !flags.hasUnapprovedMandatoryCompliance && !flags.isTerminal) {
    actions = [
      { id: "upload-contract", label: "Upload signed contract", kind: "primary" },
      ...actions.filter((a) => a.id !== "manage-contract-signing"),
    ];
  }
  if (flags.canScheduleFinalFromClientReview && flags.isClientApproved) {
    actions = [
      { id: "schedule-final", label: "Schedule final interview", kind: "primary" },
      ...actions.map((a) => (a.kind === "primary" ? { ...a, kind: "secondary" as const } : a)),
    ];
  }

  const primary = actions.find((a) => a.kind === "primary") ?? null;
  const secondaries = actions.filter((a) => a.kind === "secondary");
  // Further secondaries stay reachable from the "More" menu so no action is lost.
  return { primary, secondary: secondaries[0] ?? null, overflow: secondaries.slice(1) };
}
