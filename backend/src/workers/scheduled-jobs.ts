import prisma from "../utils/prisma.js";
import { safeLogError } from "../security/errors.js";
import { checkReviewSLABreaches } from "./review-sla.worker.js";

export interface ScheduledJob {
  name: string;
  run: () => Promise<Record<string, unknown>>;
}

// Fixed key for pg_try_advisory_xact_lock. Any number works as long as nothing else uses it.
export const SCHEDULED_JOBS_LOCK_KEY = 48_120_001;

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: "review-sla",
    run: async () => {
      const { details: _details, ...counts } = await checkReviewSLABreaches();
      return { ...counts };
    },
  },
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
