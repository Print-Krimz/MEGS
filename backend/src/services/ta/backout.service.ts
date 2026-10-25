import prisma from "../../utils/prisma.js";
import { notifyJobOwner, sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { syncMRFFulfillmentStatus } from "./ta.mrf.service.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { APPLICANT_WITHDRAWABLE_STATUSES, validateBackoutInput } from "./backout-rules.js";
import { JOB_OWNER_SELECT, type JobOwnerFields } from "./ownership.js";
import { hasNoShowHistory, retainInTalentPool } from "./talent-pool-retain.js";

export class BackoutConflictError extends Error {}

export interface RecordBackoutInput {
  applicationId: number;
  party: string;
  reason: string;
  notes?: string | null;
  occurredAt?: Date;
  /** TA choice; defaults to keeping the candidate unless the applicant pulled out. Never overrides no-show history. */
  keepInTalentPool?: boolean;
  /**
   * Disposition chosen by the TA. TALENT_POOL keeps the candidate findable; ARCHIVE hides the application.
   * When given it replaces keepInTalentPool. Applicant self-withdrawals leave it empty (nothing is chosen).
   */
  disposition?: "TALENT_POOL" | "ARCHIVE";
  actorId: string;
  actorRole: "TALENT_ACQUISITION" | "ADMINISTRATOR" | "APPLICANT";
}

/**
 * Records a backout and moves the application to BACKOUT in one transaction.
 * Rejections stay on the archive flow; exits after the deployment started stay on the deployment.
 */
export const recordBackout = async (input: RecordBackoutInput) => {
  const { applicationId, actorId, actorRole } = input;
  const isApplicant = actorRole === "APPLICANT";

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      isArchived: true,
      createdAt: true,
      jobPosting: { select: { title: true, ...JOB_OWNER_SELECT } },
      backout: { select: { id: true } },
      deployments: { select: { id: true, status: true, mrfId: true } },
    },
  });

  // Applicants only ever see their own applications; report a miss the same way.
  if (!application || (isApplicant && application.userId !== actorId)) {
    throw new Error("Application not found");
  }
  if (application.backout || application.status === "BACKOUT") {
    throw new BackoutConflictError("A backout is already recorded for this application");
  }
  if (application.isArchived || application.status === "ARCHIVED") {
    throw new Error("Cannot record a backout for an archived application");
  }
  if (isApplicant && !(APPLICANT_WITHDRAWABLE_STATUSES as readonly string[]).includes(application.status)) {
    throw new Error("This application can no longer be withdrawn online. Please contact the recruiter.");
  }

  // An applicant can only ever act for themselves.
  const party = isApplicant ? "APPLICANT" : input.party;
  let occurredAt = input.occurredAt ?? new Date();
  // A date-only entry for the day the application was submitted resolves to midnight; clamp to submission time.
  if (occurredAt < application.createdAt && manilaDateString(occurredAt) === manilaDateString(application.createdAt)) {
    occurredAt = application.createdAt;
  }
  validateBackoutInput({
    stage: application.status,
    party,
    reason: input.reason,
    occurredAt,
    applicationCreatedAt: application.createdAt,
  });

  // After DEPLOYED the candidate can only back out while the deployment has not started.
  let pendingDeployment: { id: number; mrfId: number | null } | null = null;
  if (application.status === "DEPLOYED") {
    const live = application.deployments.filter((d) => d.status === "ACTIVE");
    if (live.length > 0) {
      throw new Error("This deployment already started. End the deployment instead of recording a backout.");
    }
    pendingDeployment = application.deployments.find((d) => d.status === "READY_FOR_DEPLOYMENT") ?? null;
    if (!pendingDeployment) {
      throw new Error("No pending deployment found for this application");
    }
  }

  if (input.disposition === "TALENT_POOL" && (input.reason === "NO_SHOW" || (await hasNoShowHistory(application.userId)))) {
    throw new Error("A no-show cannot be added to the talent pool. Choose Archive instead.");
  }

  const notes = input.notes?.trim() || null;
  const fromStatus = application.status;
  const archiveNow = input.disposition === "ARCHIVE";

  const backout = await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { status: "BACKOUT", ...(archiveNow ? { isArchived: true, archivedAt: new Date() } : {}) },
    });

    const created = await tx.applicationBackout.create({
      data: {
        applicationId,
        deploymentId: pendingDeployment?.id ?? null,
        stage: fromStatus,
        party: party as any,
        reason: input.reason as any,
        notes,
        occurredAt,
        recordedById: actorId,
      },
    });

    await tx.applicationClosure.create({
      data: {
        applicationId,
        outcome: "BACKED_OUT",
        disposition: input.disposition ?? null,
        stage: fromStatus,
        reasonCode: input.reason,
        notes,
        occurredAt,
        recordedById: actorId,
      },
    });

    await tx.recruiterDecision.create({
      data: {
        applicationId,
        actorId,
        fromStatus,
        toStatus: "BACKOUT",
        reason: `Backout (${party}): ${input.reason}${notes ? ` - ${notes}` : ""}`,
        reasonCode: input.reason,
      },
    });

    if (pendingDeployment) {
      await tx.deployment.update({ where: { id: pendingDeployment.id }, data: { status: "CANCELLED" } });
      await tx.deploymentStatusHistory.create({
        data: {
          deploymentId: pendingDeployment.id,
          fromStatus: "READY_FOR_DEPLOYMENT",
          toStatus: "CANCELLED",
          changedById: actorId,
          reason: `Candidate backout (${party}): ${input.reason}`,
        },
      });
    }

    if (input.reason === "NO_SHOW") {
      await tx.applicantProfile.updateMany({
        where: { userId: application.userId },
        data: { hasNoShowHistory: true },
      });
    }
    return created;
  });

  void logAudit(actorId, "APPLICATION_BACKOUT_RECORDED", "Application", applicationId, {
    fromStatus,
    party,
    reason: input.reason,
    occurredAt: occurredAt.toISOString(),
  });

  if (pendingDeployment?.mrfId) {
    await syncMRFFulfillmentStatus(pendingDeployment.mrfId, actorId).catch(() => {});
  }

  // A disposition from the TA decides; otherwise keep the candidate findable only when the client or agency pulled out.
  const keepInPool = input.disposition ? input.disposition === "TALENT_POOL" : input.keepInTalentPool ?? party !== "APPLICANT";
  if (!isApplicant && keepInPool) {
    await retainInTalentPool({
      userId: application.userId,
      applicationId,
      actorId,
      notes: "Kept in talent pool by the recruiter after a backout",
    }).catch(() => {});
  }

  await notifyBackout({
    isApplicant,
    party,
    applicationId,
    applicantUserId: application.userId,
    jobTitle: application.jobPosting?.title ?? "the position",
    jobPosting: application.jobPosting,
  });

  return backout;
};

async function notifyBackout(args: {
  isApplicant: boolean;
  party: string;
  applicationId: number;
  applicantUserId: string;
  jobTitle: string;
  jobPosting: JobOwnerFields | null;
}) {
  const { isApplicant, party, applicationId, applicantUserId, jobTitle, jobPosting } = args;
  if (isApplicant) {
    const link = `/ta/applications/${applicationId}`;
    const title = "Applicant withdrew";
    const message = `An applicant withdrew from ${jobTitle}.`;
    await notifyJobOwner(jobPosting, title, message, "WARNING", link);
    return;
  }
  await sendNotification(
    applicantUserId,
    "Application closed",
    party === "APPLICANT"
      ? `Your application for ${jobTitle} was closed because you were unable to continue with the process.`
      : `Your application for ${jobTitle} was closed because the placement did not go ahead.`,
    "INFO",
    `/app/applications/${applicationId}`
  );
}
