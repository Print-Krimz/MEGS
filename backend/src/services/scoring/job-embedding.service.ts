import { createHash } from "node:crypto";
import prisma from "../../utils/prisma.js";
import { generateJobEmbedding } from "./embedding.service.js";
import { buildJobEmbeddingText } from "./match-score.js";

/**
 * Stores the job vector used by applicant recommendations. The text hash makes this safe to call
 * on every create, edit and hourly repair: Gemini is only called when the embedded text changed.
 * Never throws; recommendations fall back to rule-based scoring without a vector.
 */
export const ensureJobEmbedding = async (jobId: number): Promise<"updated" | "unchanged" | "failed"> => {
  try {
    const job = await prisma.jobPosting.findUnique({
      where: { id: jobId },
      select: { title: true, requirements: true, location: true, embeddingTextHash: true, mrf: true },
    });
    if (!job) return "failed";

    const text = buildJobEmbeddingText(job, job.mrf);
    const hash = createHash("sha256").update(text).digest("hex");
    if (job.embeddingTextHash === hash) return "unchanged";

    const vector = `[${(await generateJobEmbedding(text)).join(",")}]`;
    await prisma.$executeRaw`UPDATE "JobPosting" SET "embedding" = ${vector}::vector, "embeddingTextHash" = ${hash} WHERE "id" = ${jobId}`;
    return "updated";
  } catch (error) {
    console.error("[JobEmbedding] failed", { jobId, message: error instanceof Error ? error.message : "unknown" });
    return "failed";
  }
};

/** Repairs open jobs with no stored vector or a stale one. Used by the hourly job. */
export const backfillOpenJobEmbeddings = async (limit = 20) => {
  const jobs = await prisma.jobPosting.findMany({ where: { status: "OPEN" }, select: { id: true }, orderBy: { id: "asc" } });
  const result = { scanned: jobs.length, updated: 0, failed: 0 };
  for (const { id } of jobs) {
    if (result.updated + result.failed >= limit) break;
    const outcome = await ensureJobEmbedding(id);
    if (outcome === "updated") result.updated += 1;
    if (outcome === "failed") result.failed += 1;
  }
  return result;
};
