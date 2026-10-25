import prisma from "../utils/prisma.js";
import { notifyOwner } from "../utils/notification.js";
import { manilaDateString } from "../schemas/field-limits.js";
import { jobOwnerTaId } from "../services/ta/ownership.js";
import { safeLogError } from "../security/errors.js";

export interface ReviewSLABreachResult {
  scannedCount: number;
  breachedCount: number;
  notifiedCount: number;
  skippedDuplicateCount: number;
  failedCount: number;
  details: Array<{
    endorsementId: number;
    applicationId: number;
    clientId: number;
    clientName: string;
    elapsedDays: number;
    thresholdDays: number;
    recruiterId: string | null;
    notified: boolean;
  }>;
}

// Once a review is overdue, the owner is reminded on the breach day and then every 3 Manila days.
export const SLA_REMINDER_EVERY_DAYS = 3;

// Endorsements only need a client decision while the application is still in play.
const CLOSED_STATUSES = ["REJECTED", "BACKOUT", "ARCHIVED", "HIRED", "DEPLOYED"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole Manila calendar days from one instant to another (endorsed 23:30, checked 00:30 next day = 1). */
export const manilaDaysBetween = (from: Date, to: Date): number =>
  Math.round((Date.parse(manilaDateString(to)) - Date.parse(manilaDateString(from))) / DAY_MS);

/**
 * Evaluates all pending client endorsements against client review SLA thresholds.
 * Reminds the TA who owns the requisition (Admins when it is unassigned) on the breach day,
 * then every SLA_REMINDER_EVERY_DAYS days. Each reminder carries a dedupe key for its Manila day,
 * so a repeated run on the same day never sends it twice.
 *
 * CRITICAL INVARIANT: The system NEVER automatically declines or rejects candidates.
 * Application status and endorsement outcome remain strictly unmodified.
 */
export const checkReviewSLABreaches = async (
  now: Date = new Date()
): Promise<ReviewSLABreachResult> => {
  const endorsements = await prisma.clientEndorsement.findMany({
    where: {
      outcome: "PENDING",
      application: {
        isArchived: false,
        status: { notIn: [...CLOSED_STATUSES] },
      },
    },
    include: {
      client: true,
      application: {
        include: {
          user: {
            include: {
              applicantProfile: true,
            },
          },
          jobPosting: {
            include: {
              mrf: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const result: ReviewSLABreachResult = {
    scannedCount: endorsements.length,
    breachedCount: 0,
    notifiedCount: 0,
    skippedDuplicateCount: 0,
    failedCount: 0,
    details: [],
  };
  const today = manilaDateString(now);

  for (const endorsement of endorsements) {
    if (!endorsement.application || endorsement.application.isArchived) {
      continue;
    }

    const rawThreshold = endorsement.client?.reviewThresholdDays;
    const thresholdDays =
      typeof rawThreshold === "number" && rawThreshold > 0 ? rawThreshold : 5;

    const elapsedDays = Math.max(0, manilaDaysBetween(endorsement.createdAt, now));
    const overdueDays = elapsedDays - thresholdDays;
    if (overdueDays < 0) continue;

    result.breachedCount++;
    const jobPosting = endorsement.application.jobPosting;
    const recruiterId = jobPosting ? jobOwnerTaId(jobPosting) : null;
    let notified = false;

    if (overdueDays % SLA_REMINDER_EVERY_DAYS === 0) {
      const clientName = endorsement.client?.name || "Client";
      const profile = endorsement.application.user?.applicantProfile;
      const candidateName = profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : endorsement.application.user?.email || "Candidate";
      const jobTitle = jobPosting?.title || "Requisition";

      try {
        const tally = await notifyOwner(
          recruiterId,
          `Client Review SLA Overdue: ${clientName}`,
          `Client evaluation for candidate ${candidateName} on "${jobTitle}" has exceeded ${clientName}'s review threshold (${elapsedDays} of ${thresholdDays} days). Please follow up with the client.`,
          "WARNING",
          `/ta/applications/${endorsement.applicationId}`,
          {
            // Email only on the breach day; later reminders stay in-app.
            sendEmail: overdueDays === 0,
            dedupeKey: `review-sla:${endorsement.id}:${today}`,
          }
        );
        result.notifiedCount += tally.sent;
        result.skippedDuplicateCount += tally.duplicate;
        result.failedCount += tally.failed;
        notified = tally.sent > 0;
      } catch (error) {
        // One bad row must not stop the rest of the run.
        result.failedCount++;
        safeLogError(`Review SLA reminder for endorsement ${endorsement.id}`, error);
      }
    }

    result.details.push({
      endorsementId: endorsement.id,
      applicationId: endorsement.applicationId,
      clientId: endorsement.clientId,
      clientName: endorsement.client?.name || "Client",
      elapsedDays,
      thresholdDays,
      recruiterId,
      notified,
    });
  }

  return result;
};
