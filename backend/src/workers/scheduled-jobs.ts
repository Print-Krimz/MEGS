import prisma from "../utils/prisma.js";
import { safeLogError } from "../security/errors.js";
import { checkReviewSLABreaches } from "./review-sla.worker.js";
import { purgeExpiredAuthTokens } from "./auth-token-purge.js";
import { REMINDER_JOBS } from "./reminders/index.js";
import { sendSmsOutbox } from "./sms-outbox.js";

export interface ScheduledJob {
  name: string;
  run: () => Promise<Record<string, unknown>>;
}

// Fixed key for pg_try_advisory_xact_lock. Any number works as long as nothing else uses it.
export const SCHEDULED_JOBS_LOCK_KEY = 48_120_001;

export const STALE_ANALYSIS_MINUTES = 30;

/**
 * Exposes interrupted resume analysis (for example after a restart that emptied the in-memory
 * worker queue) by marking it NEEDS_ATTENTION so staff can use the existing retry. This is not a
 * durable queue: nothing is re-run automatically. Only initial-stage applications that have sat
 * unfinished past the cutoff are touched. The worker always writes `aiSummary` (and `aiScore` on success),
 * so SUBMITTED with no `aiSummary` never finished analysis, with or without dynamic scoring; the same conditions are the update guard, so it is
 * idempotent and never changes advanced stages or an application changed since the cutoff.
 */
export const reconcileStaleResumeAnalysis = async (now: Date = new Date()): Promise<Record<string, unknown>> => {
  const cutoff = new Date(now.getTime() - STALE_ANALYSIS_MINUTES * 60_000);
  const { count } = await prisma.application.updateMany({
    where: {
      isArchived: false,
      resumeUrl: { not: null },
      updatedAt: { lt: cutoff },
      OR: [{ status: "PARSING" }, { status: "SUBMITTED", aiSummary: null }],
    },
    data: {
      status: "NEEDS_ATTENTION",
      aiSummary: "Resume analysis did not finish. Retry resume analysis or review manually.",
    },
  });
  return { staleAnalysisMarked: count };
};

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: "review-sla",
    run: async () => {
      const { details: _details, ...counts } = await checkReviewSLABreaches();
      return { ...counts };
    },
  },
  { name: "stale-resume-analysis", run: () => reconcileStaleResumeAnalysis() },
  { name: "auth-token-purge", run: () => purgeExpiredAuthTokens() },
  ...REMINDER_JOBS,
  { name: "sms-outbox", run: () => sendSmsOutbox() },
];

export interface ScheduledRunResult {
  status: "ran" | "locked";
  failedJobs: string[];
}

/**
 * Runs every scheduled job once, inside one transaction that holds a Postgres advisory lock.
 * A second run that starts while the first is still going finds the lock taken and skips.
 * The transaction-scoped lock also works through the Supabase transaction pooler.
 * Jobs use the shared client, not the transaction, so the lock is the only thing held open.
 */
export const runScheduledJobs = async (jobs: ScheduledJob[] = SCHEDULED_JOBS): Promise<ScheduledRunResult> =>
  prisma.$transaction(
    async (tx) => {
      const [row] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(${SCHEDULED_JOBS_LOCK_KEY}) AS locked`;
      if (!row?.locked) {
        console.log("[jobs] Another run holds the lock; skipping.");
        return { status: "locked", failedJobs: [] };
      }
      const failedJobs: string[] = [];
      for (const job of jobs) {
        try {
          // Counts only: never log names or other personal data here.
          console.log(`[jobs] ${job.name}`, JSON.stringify(await job.run()));
        } catch (error) {
          failedJobs.push(job.name);
          safeLogError(`Scheduled job ${job.name}`, error);
        }
      }
      return { status: "ran", failedJobs };
    },
    { maxWait: 10_000, timeout: 10 * 60_000 }
  );
