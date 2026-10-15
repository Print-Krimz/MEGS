import prisma from "../../utils/prisma.js";
import { sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { BackoutConflictError, recordBackout } from "./backout.service.js";
import { ALLOWED_TRANSITIONS } from "./pipeline-rules.js";
import { hasNoShowHistory, retainInTalentPool } from "./talent-pool-retain.js";

export type ClosureOutcomeValue = "REJECTED" | "BACKED_OUT";
export type ClosureDispositionValue = "TALENT_POOL" | "ARCHIVE";

export interface CloseApplicationInput {
  applicationId: number;
  outcome: ClosureOutcomeValue;
  reasonCode: string;
  disposition: ClosureDispositionValue;
  notes?: string | null;
  occurredAt?: Date;
  actorId: string;
  actorRole: "TALENT_ACQUISITION" | "ADMINISTRATOR";
}

const humanize = (code: string) => code.toLowerCase().replace(/_/g, " ");

/**
 * Closes an application as Rejected or Backed Out and records the disposition (Talent Pool or Archive).
 * Backed Out reuses the backout rules; Rejected is handled here. One live closure per application.
 */
export const closeApplication = async (input: CloseApplicationInput) => {
  if (input.outcome === "BACKED_OUT") {
    return recordBackout({
      applicationId: input.applicationId,
      party: "APPLICANT",
      reason: input.reasonCode,
      notes: input.notes,
      occurredAt: input.occurredAt,
      disposition: input.disposition,
      actorId: input.actorId,
      actorRole: input.actorRole,
    });
  }
  return rejectApplication(input);
};

export const rejectApplication = async (input: CloseApplicationInput) => {
  const { applicationId, actorId, disposition } = input;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      status: true,
      isArchived: true,
      jobPosting: { select: { title: true } },
      closures: { where: { reopenedAt: null }, select: { id: true } },
    },
  });
  if (!application) throw new Error("Application not found");
  if (application.closures.length > 0 || application.status === "REJECTED" || application.status === "BACKOUT") {
    throw new BackoutConflictError("This application is already closed");
  }
  if (application.isArchived || application.status === "ARCHIVED") {
    throw new Error("Cannot reject an archived application. Restore it first.");
  }
  const allowed = ALLOWED_TRANSITIONS[application.status] ?? [];
  if (!allowed.includes("REJECTED")) {
    throw new Error(`An application in ${application.status} cannot be rejected`);
  }
  // Same stage rule as the old talent pool move: the pool needs a reviewed candidate.
  if (disposition === "TALENT_POOL" && !allowed.includes("TALENT_POOL")) {
    throw new Error("This candidate has not been reviewed yet. Choose Archive instead.");
  }
  if (disposition === "TALENT_POOL" && (await hasNoShowHistory(application.userId))) {
    throw new Error("A candidate with a no-show cannot be added to the talent pool. Choose Archive instead.");
  }

  const notes = input.notes?.trim() || null;
  const fromStatus = application.status;
  const decisionReason = notes ? `${humanize(input.reasonCode)}: ${notes}` : humanize(input.reasonCode);
  const occurredAt = input.occurredAt ?? new Date();

  const closure = await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        status: "REJECTED",
        ...(disposition === "ARCHIVE" ? { isArchived: true, archivedAt: new Date() } : {}),
      },
    });
    const created = await tx.applicationClosure.create({
      data: {
        applicationId,
        outcome: "REJECTED",
        disposition,
        stage: fromStatus,
        reasonCode: input.reasonCode,
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
        toStatus: "REJECTED",
        reason: decisionReason,
        reasonCode: input.reasonCode,
      },
    });
    return created;
  });

  void logAudit(actorId, "APPLICATION_REJECTED", "Application", applicationId, {
    fromStatus,
    reasonCode: input.reasonCode,
    disposition,
  });

  if (disposition === "TALENT_POOL") {
    await retainInTalentPool({
      userId: application.userId,
      applicationId,
      actorId,
      notes: notes ?? "Kept in talent pool after rejection",
    }).catch(() => {});
  }

  await sendNotification(
    application.userId,
    "Application Update",
    disposition === "TALENT_POOL"
      ? "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications."
      : "Your application consideration has concluded.",
    "INFO",
    `/app/applications/${applicationId}`,
    { sendEmail: true, ctaText: "View Application" }
  ).catch(() => {});

  return closure;
};
