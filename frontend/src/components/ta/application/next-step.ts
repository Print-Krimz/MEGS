import type { Application } from "../../../lib/types";
import { ApplicationStatus } from "../../../lib/types/enums";
import { formatDate } from "../../../lib/utils";
import { deploymentStatusLabel } from "../../../lib/labels";
import { plural } from "../../../lib/plural";
import { deploymentStartsOn } from "../../../lib/ta-copy";
import type { ApplicationFlags } from "./stage-actions";

/**
 * The one definition of "what is left" in the requirements list. Used by the next-step line, the
 * readiness card and (through the same flags) the tab badge: documents to review are the submitted ones.
 */
export function describeRequirementProgress(submitted: number, notSubmitted: number): string {
  const parts: string[] = [];
  if (submitted > 0) parts.push(`${plural(submitted, "document")} to review`);
  if (notSubmitted > 0) parts.push(`${notSubmitted} not yet submitted`);
  return parts.join(". ");
}

export interface NextStep {
  text: string;
  /** True when the step belongs to the TA (an action is waiting on them). False when waiting on someone else or finished. */
  needsTa: boolean;
}

/**
 * One sentence that says what happens next. The wording reuses the blocker text the page and the
 * deployment readiness list already showed, so a recruiter reads the same line in both places.
 */
export function getNextStep(app: Application, flags: ApplicationFlags): NextStep {
  const status = app.status as string;

  if (status === ApplicationStatus.DEPLOYED) {
    const deployment = app.deployments?.[0];
    if (!deployment) return { text: "Deployed. The deployment record is created.", needsTa: false };
    const parts = [deploymentStatusLabel(deployment.status)];
    if (deployment.status === "READY_FOR_DEPLOYMENT" && deployment.contractStart) {
      parts.push(deploymentStartsOn(formatDate(deployment.contractStart)));
    }
    return { text: `Deployment: ${parts.join(" · ")}`, needsTa: deployment.status === "READY_FOR_DEPLOYMENT" };
  }
  if (flags.isTerminal) return { text: "This application is closed.", needsTa: false };
  if (status === ApplicationStatus.TALENT_POOL) return { text: "In the candidate pool. Invite the candidate to a new opening.", needsTa: false };

  if (flags.isPreScreeningOrScreening) {
    if (flags.canRecordInitialInterview) return { text: "Next: record the screening outcome.", needsTa: true };
    if (flags.canAdvanceToClientEndorsement) return { text: "Next: send the candidate to the client, or skip to final interview.", needsTa: true };
    return { text: "Next: schedule the initial screening.", needsTa: true };
  }

  if (flags.isClientEndorsementStage) {
    if (!flags.latestEndorsement) return { text: "Next: send the candidate to the client.", needsTa: true };
    if (flags.isPendingClientReview) {
      // Name the client and the send date so the recruiter does not have to open the requirements tab.
      const clientName = flags.latestEndorsement?.client?.name || app.jobPosting?.mrf?.client?.name;
      const sent = flags.latestEndorsement?.createdAt ? ` since ${formatDate(flags.latestEndorsement.createdAt)}` : "";
      return { text: `Waiting for ${clientName || "the client"}${sent}. Record their decision when you hear back.`, needsTa: true };
    }
    if (flags.isClientDeclined) return { text: "The client declined. Update the decision or close the application.", needsTa: true };
    if (flags.canScheduleFinalFromClientReview) return { text: "Client approved. Next: schedule the final interview.", needsTa: true };
    return { text: "Client approved.", needsTa: false };
  }

  if (flags.isFinalInterviewStage) {
    if (flags.canAdvanceToCompliance) return { text: "Next: move the candidate to requirements.", needsTa: true };
    if (flags.canRecordFinalInterview) return { text: "Next: record the client interview outcome.", needsTa: true };
    return { text: "Next: schedule the final interview.", needsTa: true };
  }

  if (flags.isComplianceStage) {
    if (flags.canAdvanceToContractSigning) {
      return { text: "All required documents are approved. Next: move the candidate to contract signing.", needsTa: true };
    }
    const detail =
      flags.totalCompReqs === 0
        ? "The requirements list is not ready yet."
        : (describeRequirementProgress(flags.submittedCompReqs, flags.missingCompReqs) || "Waiting on the remaining requirements") + ".";
    return { text: `Required items still pending. ${detail}`, needsTa: true };
  }

  if (flags.isContractSigningStage) {
    if (!flags.isContractSigned) {
      return { text: "Next: upload the signed contract. Saving it deploys the candidate.", needsTa: !flags.hasUnapprovedMandatoryCompliance };
    }
    if (flags.openDeployment) return { text: "Next: confirm the start date on the deployment record.", needsTa: true };
    return { text: "Next: activate the deployment.", needsTa: true };
  }

  return { text: "", needsTa: false };
}
