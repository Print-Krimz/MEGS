import prisma from "../utils/prisma.js";
import { sendNotification } from "../utils/notification.js";

export interface ReviewSLABreachResult {
  scannedCount: number;
  breachedCount: number;
  notifiedCount: number;
  skippedDuplicateCount: number;
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

/**
 * Evaluates all pending client endorsements against client review SLA thresholds.
 * Sends warning notifications to handling recruiters when the SLA is breached,
 * adhering to a 24-hour deduplication window.
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
    details: [],
  };

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const endorsement of endorsements) {
    if (!endorsement.application || endorsement.application.isArchived) {
      continue;
    }

    const rawThreshold = endorsement.client?.reviewThresholdDays;
    const thresholdDays =
      typeof rawThreshold === "number" && rawThreshold > 0 ? rawThreshold : 5;

    const elapsedDays = Math.max(
      0,
      Math.floor((now.getTime() - endorsement.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (elapsedDays >= thresholdDays) {
      result.breachedCount++;

      // Recruiter recipient priority:
      // Priority 1: endorsement.endorsedById
      // Priority 2: endorsement.application.jobPosting?.postedById
      // Priority 3: endorsement.application.jobPosting?.mrf?.createdById
      const recruiterId =
        endorsement.endorsedById ||
        endorsement.application?.jobPosting?.postedById ||
        endorsement.application?.jobPosting?.mrf?.createdById ||
        null;

      const clientName = endorsement.client?.name || "Client";
      const profile = endorsement.application?.user?.applicantProfile;
      const candidateName = profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : endorsement.application?.user?.email || "Candidate";
      const jobTitle = endorsement.application?.jobPosting?.title || "Requisition";

      let notified = false;

      if (recruiterId) {
        // Deduplicate: Check if a warning notification for this application endorsement
        // was already sent to this recruiter within the last 24 hours ([now - 24h, now]).
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: recruiterId,
            link: `/ta/applications/${endorsement.applicationId}`,
            type: "WARNING",
            createdAt: {
              gte: twentyFourHoursAgo,
              lte: now,
            },
            title: { contains: "Client Review SLA Overdue" },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        if (existingNotification) {
          result.skippedDuplicateCount++;
        } else {
          const title = `Client Review SLA Overdue: ${clientName}`;
          const message = `Client evaluation for candidate ${candidateName} on "${jobTitle}" has exceeded ${clientName}'s review threshold (${elapsedDays} of ${thresholdDays} days). Please follow up with the client.`;
          const link = `/ta/applications/${endorsement.applicationId}`;

          try {
            await sendNotification(recruiterId, title, message, "WARNING", link, {
              sendEmail: true,
            });
            result.notifiedCount++;
            notified = true;
          } catch (notifErr) {
            console.error(
              `[ReviewSLAWorker] Failed to notify recruiter ${recruiterId}:`,
              notifErr
            );
          }
        }
      }

      result.details.push({
        endorsementId: endorsement.id,
        applicationId: endorsement.applicationId,
        clientId: endorsement.clientId,
        clientName,
        elapsedDays,
        thresholdDays,
        recruiterId,
        notified,
      });
    }
  }

  return result;
};

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;
let activeCyclePromise: Promise<void> | null = null;

const runWorkerCycle = async (): Promise<void> => {
  if (isProcessing) return;
  isProcessing = true;
  try {
    await checkReviewSLABreaches();
  } catch (err) {
    console.error("[ReviewSLAWorker] Error in periodic cycle:", err);
  } finally {
    isProcessing = false;
  }
};

/**
 * Starts the periodic review SLA breach detection worker.
 * Defaults to running every hour (3600000 ms).
 */
export const startReviewSLAWorker = (
  intervalMs: number = 60 * 60 * 1000
): void => {
  if (workerInterval) return;
  console.log("⏱️ Review SLA monitoring worker started");
  activeCyclePromise = runWorkerCycle().catch((err) =>
    console.error("[ReviewSLAWorker] Immediate cycle error:", err)
  );
  workerInterval = setInterval(() => {
    activeCyclePromise = runWorkerCycle().catch((err) =>
      console.error("[ReviewSLAWorker] Interval cycle error:", err)
    );
  }, intervalMs);
  workerInterval.unref?.();
};

/**
 * Stops the periodic review SLA worker and clears the timer.
 */
export const stopReviewSLAWorker = async (): Promise<void> => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  if (activeCyclePromise) {
    try {
      await activeCyclePromise;
    } catch {}
    activeCyclePromise = null;
  }
};
