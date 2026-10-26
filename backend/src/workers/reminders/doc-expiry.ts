import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { JOB_OWNER_SELECT, jobOwnerTaId } from "../../services/ta/ownership.js";
import { safeLogError } from "../../security/errors.js";
import {
  addTally,
  daysUntilDue,
  dueSince, dueWithin,
  expiryMilestone,
  formatDue,
  newResult,
  notifyApplicant,
  reminderKey,
  withinEmailCatchup,
  type ReminderResult,
} from "./rules.js";

const PRE_START_STAGES = ["COMPLIANCE", "CONTRACT_SIGNING"] as const;
// A DEPLOYED application only counts while its worker is still placed; ended or cancelled placements are left alone.
const LIVE_DEPLOYMENT_STATUSES = ["ACTIVE", "READY", "DISPATCHED", "READY_FOR_DEPLOYMENT"] as const;

/**
 * Approved documents that expire within 30 days (or already have).
 * Only the latest milestone is sent: expiring-30, expiring-7, then expired.
 * Applicant gets in-app and email; the owner TA gets in-app.
 */
export const sendDocExpiryReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.complianceRequirement.findMany({
    where: {
      reviewStatus: "APPROVED",
      expiresAt: { not: null, gte: dueSince(now), lte: dueWithin(now, 30) },
      application: {
        isArchived: false,
        OR: [
          { status: { in: [...PRE_START_STAGES] } },
          { status: "DEPLOYED", deployments: { some: { status: { in: [...LIVE_DEPLOYMENT_STATUSES] } } } },
        ],
      },
    },
    select: {
      id: true,
      documentLabel: true,
      expiresAt: true,
      application: { select: { id: true, userId: true, jobPosting: { select: JOB_OWNER_SELECT } } },
    },
  });

  const result = newResult();
  result.scannedCount = rows.length;

  for (const row of rows) {
    if (!row.expiresAt || !row.application) continue;
    try {
      const days = daysUntilDue(row.expiresAt, now);
      const milestone = expiryMilestone(days);
      if (!milestone) continue;
      const dueText = formatDue(row.expiresAt);
      const expired = milestone === "expired";
      const title = expired ? "Document expired" : "Document expiring";
      const key = reminderKey("doc-expiry", row.id, row.expiresAt, milestone);
      const applicationId = row.application.id;

      addTally(
        result,
        await notifyApplicant(
          row.application.userId,
          title,
          expired
            ? `Your ${row.documentLabel} expired on ${dueText}. Please upload a new copy.`
            : `Your ${row.documentLabel} expires on ${dueText}. Please upload a new copy before then.`,
          "WARNING",
          `/app/applications/${applicationId}`,
          { dedupeKey: key, sendEmail: withinEmailCatchup(days), ctaText: "Open application" }
        )
      );
      addTally(
        result,
        await notifyOwner(
          row.application.jobPosting ? jobOwnerTaId(row.application.jobPosting) : null,
          title,
          expired
            ? `${row.documentLabel} expired on ${dueText} for application #${applicationId}.`
            : `${row.documentLabel} expires on ${dueText} for application #${applicationId}.`,
          "WARNING",
          `/ta/applications/${applicationId}`,
          { dedupeKey: key, sendEmail: false }
        )
      );
    } catch (error) {
      result.failedCount++;
      safeLogError(`doc-expiry reminder for requirement ${row.id}`, error);
    }
  }
  return result;
};
