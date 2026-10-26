import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { expirePendingInvitationsWorker } from "../../services/ta/talent-pool-invitation.service.js";
import { jobOwnerTaId } from "../../services/ta/ownership.js";
import { safeLogError } from "../../security/errors.js";
import { addTally, daysUntilDue, formatDue, newResult, notifyApplicant, reminderKey, type ReminderResult } from "./rules.js";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Expires overdue invitations (owner TA gets one in-app notice each), then warns applicants
 * whose pending invitation ends within a day (in-app and email).
 */
export const sendInvitationExpiryReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const result = newResult();

  const { expired } = await expirePendingInvitationsWorker();
  result.scannedCount += expired.length;
  for (const invitation of expired) {
    try {
      addTally(
        result,
        await notifyOwner(
          invitation.job ? jobOwnerTaId(invitation.job) : null,
          "Job offer expired",
          `A job offer for ${invitation.jobTitle ?? "a requisition"} expired without a reply.`,
          "INFO",
          "/ta/talent-pool",
          { dedupeKey: `invitation-expired:${invitation.id}`, sendEmail: false }
        )
      );
    } catch (error) {
      result.failedCount++;
      safeLogError(`invitation-expiry notice for invitation ${invitation.id}`, error);
    }
  }

  const pending = await prisma.talentPoolInvitation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { not: null, gt: now, lte: new Date(now.getTime() + TWO_DAYS_MS) },
    },
    select: {
      id: true,
      expiresAt: true,
      applicantProfile: { select: { userId: true } },
      jobPosting: { select: { title: true } },
    },
  });
  result.scannedCount += pending.length;

  for (const invitation of pending) {
    if (!invitation.expiresAt || !invitation.applicantProfile) continue;
    try {
      // Pending and not yet expired: it ends today or tomorrow in Manila.
      if (daysUntilDue(invitation.expiresAt, now) > 1) continue;
      addTally(
        result,
        await notifyApplicant(
          invitation.applicantProfile.userId,
          "Job offer ending soon",
          `Your job offer for ${invitation.jobPosting?.title ?? "a position"} ends on ${formatDue(invitation.expiresAt)}. Reply before then.`,
          "WARNING",
          "/app/invitations",
          {
            dedupeKey: reminderKey("invitation-expiry", invitation.id, invitation.expiresAt, "soon"),
            sendEmail: true,
            ctaText: "View job offer",
          }
        )
      );
    } catch (error) {
      result.failedCount++;
      safeLogError(`invitation-expiry reminder for invitation ${invitation.id}`, error);
    }
  }
  return result;
};
