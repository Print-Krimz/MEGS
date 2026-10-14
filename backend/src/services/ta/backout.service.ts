import prisma from "../../utils/prisma.js";
import { sendNotification, sendRoleNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { rebuildCandidateFeatureProfile } from "../scoring/talent-pool-knn.service.js";
import { syncMRFFulfillmentStatus } from "./ta.mrf.service.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import { APPLICANT_WITHDRAWABLE_STATUSES, validateBackoutInput } from "./backout-rules.js";

export class BackoutConflictError extends Error {}

export interface RecordBackoutInput {
  applicationId: number;
  party: string;
  reason: string;
  notes?: string | null;
  occurredAt?: Date;
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
      jobPosting: { select: { title: true, postedById: true, mrfId: true } },
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

  const notes = input.notes?.trim() || null;
  const fromStatus = application.status;

  const backout = await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: applicationId }, data: { status: "BACKOUT" } });

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

  // The candidate is not at fault when the client or agency pulled out: keep them findable for other openings.
  if (party !== "APPLICANT") {
    await returnToTalentPool(application.userId, applicationId, actorId).catch(() => {});
  }

  await notifyBackout({
    isApplicant,
    applicationId,
    applicantUserId: application.userId,
    jobTitle: application.jobPosting?.title ?? "the position",
    postedById: application.jobPosting?.postedById ?? null,
  });

  return backout;
};

async function returnToTalentPool(userId: string, applicationId: number, actorId: string) {
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    select: { id: true, hasNoShowHistory: true },
  });
  if (!profile || profile.hasNoShowHistory) return;
  const notes = "Returned to talent pool after backout not caused by the candidate";
  await prisma.talentPoolMembership.upsert({
    where: { applicantProfileId: profile.id },
    create: {
      applicantProfileId: profile.id,
      sourceApplicationId: applicationId,
      status: "ACTIVE",
      availability: "AVAILABLE",
      addedById: actorId,
      notes,
    },
    update: { sourceApplicationId: applicationId, status: "ACTIVE", availability: "AVAILABLE", notes },
  });
  await rebuildCandidateFeatureProfile(profile.id).catch(() => {});
}

async function notifyBackout(args: {
  isApplicant: boolean;
  applicationId: number;
  applicantUserId: string;
  jobTitle: string;
  postedById: string | null;
}) {
  const { isApplicant, applicationId, applicantUserId, jobTitle, postedById } = args;
  if (isApplicant) {
    const link = `/ta/applications/${applicationId}`;
    const title = "Applicant withdrew";
    const message = `An applicant withdrew from ${jobTitle}.`;
    if (postedById) await sendNotification(postedById, title, message, "WARNING", link);
    else await sendRoleNotification("TALENT_ACQUISITION", title, message, "WARNING", link);
    return;
  }
  await sendNotification(
    applicantUserId,
    "Application closed",
    `Your application for ${jobTitle} was closed because the placement did not go ahead.`,
    "INFO",
    `/app/applications/${applicationId}`
  );
}
