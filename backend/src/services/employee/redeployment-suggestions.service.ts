import prisma from "../../utils/prisma.js";
import { generateJobEmbeddings } from "../scoring/embedding.service.js";
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";

const MAX_SUGGESTIONS_PER_WORKER = 20;
const MAX_OPEN_JOBS = 60;

export type SuggestionBasis = "SAME_CLIENT" | "PROFILE_MATCH" | "KEYWORDS";

export interface RedeploymentJobSuggestion {
  jobId: number;
  title: string;
  clientName: string | null;
  location: string | null;
  sameClient: boolean;
  basis: SuggestionBasis;
  /** 0–100 when ranked by profile similarity, otherwise null. */
  matchPercent: number | null;
}

const STOP_WORDS = new Set(["and", "the", "for", "with", "staff", "worker", "operator", "assistant", "light", "medium", "heavy"]);

const keywords = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word))
  );

const parseVector = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as number[]) : null;
  } catch {
    return null;
  }
};

const cosine = (a: number[], b: number[]) => {
  if (a.length !== b.length || a.length === 0) return null;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : null;
};

/**
 * Suggests open jobs for each worker in the redeployment queue.
 * Ranking: jobs at a client the worker was placed with first (they skip screening),
 * then profile similarity (embeddings), falling back to keyword overlap with the
 * worker's previous roles and skills when embeddings are unavailable.
 */
export const listRedeploymentSuggestions = async () => {
  const [employees, jobs, configuration] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "AVAILABLE_FOR_REDEPLOYMENT", deployments: { none: { status: { notIn: ["ENDED", "CANCELLED"] } } } },
      select: {
        id: true,
        position: true,
        deployments: {
          // Started placements only, matching the same-client routing rule on application submission.
          where: {
            status: { in: ["ACTIVE", "ENDED"] },
            OR: [
              { actualStart: { not: null } },
              { statusHistory: { some: { toStatus: "ACTIVE" } } },
              { status: "ENDED", contractStart: { not: null } },
            ],
          },
          select: { clientId: true, mrf: { select: { title: true } }, application: { select: { jobPosting: { select: { title: true } } } } },
        },
        user: {
          select: {
            applications: { where: { status: { notIn: ["BACKOUT", "ARCHIVED"] } }, select: { jobPostingId: true } },
            applicantProfile: {
              select: {
                id: true,
                skills: { select: { skill: { select: { name: true } } } },
                invitations: { where: { status: "PENDING" }, select: { jobPostingId: true } },
              },
            },
          },
        },
      },
    }),
    prisma.jobPosting.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: MAX_OPEN_JOBS,
      select: {
        id: true,
        title: true,
        description: true,
        requirements: true,
        location: true,
        mrf: {
          select: {
            clientId: true,
            client: { select: { name: true } },
            requiredSkills: true,
            requiredExperience: true,
            requiredEducation: true,
            requiredCertifications: true,
          },
        },
      },
    }),
    getActiveScoringConfiguration().catch(() => null),
  ]);

  if (employees.length === 0 || jobs.length === 0) return { items: {} as Record<number, { total: number; suggestions: RedeploymentJobSuggestion[] }> };

  const profileIds = employees.map((e) => e.user.applicantProfile?.id).filter((id): id is number => Boolean(id));
  const candidateVectors = new Map<number, number[]>();
  try {
    const rows = await prisma.$queryRaw<Array<{ applicantProfileId: number; embedding: string | null }>>`
      SELECT "applicantProfileId", "embedding"::text AS "embedding"
      FROM "CandidateFeatureProfile"
      WHERE "applicantProfileId" = ANY(${profileIds}) AND "embedding" IS NOT NULL
    `;
    for (const row of rows) {
      const vector = parseVector(row.embedding);
      if (vector) candidateVectors.set(row.applicantProfileId, vector);
    }
  } catch {
    // pgvector unavailable: fall back to keyword matching below.
  }

  // One batched request for all open jobs; results are cached in memory, so repeat loads are cheap.
  const jobVectors = new Map<number, number[]>();
  if (candidateVectors.size > 0) {
    const texts = jobs.map((job) =>
      [
        job.title,
        job.description,
        job.requirements,
        job.mrf?.requiredSkills,
        job.mrf?.requiredExperience,
        job.mrf?.requiredEducation,
        job.mrf?.requiredCertifications,
      ].filter(Boolean).join(" ")
    );
    try {
      const vectors = await generateJobEmbeddings(texts);
      jobs.forEach((job, index) => jobVectors.set(job.id, vectors[index]));
    } catch {
      // Embedding service unavailable: keyword fallback applies.
    }
  }

  const minimumSimilarity = configuration?.knnSettings.minimumSimilarity ?? 0.5;
  const jobTitleKeywords = new Map(jobs.map((job) => [job.id, keywords(job.title)]));
  const jobKeywords = new Map(jobs.map((job) => [job.id, keywords(`${job.title} ${job.requirements ?? ""} ${job.mrf?.requiredSkills ?? ""}`)]));

  const items: Record<number, { total: number; suggestions: RedeploymentJobSuggestion[] }> = {};
  for (const employee of employees) {
    const profile = employee.user.applicantProfile;
    const pastClients = new Set(employee.deployments.map((d) => d.clientId));
    const excluded = new Set([
      ...employee.user.applications.map((a) => a.jobPostingId),
      ...(profile?.invitations ?? []).map((i) => i.jobPostingId),
    ]);
    const workerVector = profile ? candidateVectors.get(profile.id) : undefined;
    const workerKeywords = keywords(
      [
        employee.position,
        ...employee.deployments.map((d) => d.application?.jobPosting.title || d.mrf?.title),
        ...(profile?.skills ?? []).map((s) => s.skill.name),
      ].filter(Boolean).join(" ")
    );

    const ranked = jobs
      .filter((job) => !excluded.has(job.id))
      .map((job) => {
        const sameClient = job.mrf?.clientId != null && pastClients.has(job.mrf.clientId);
        const jobVector = jobVectors.get(job.id);
        const similarity = workerVector && jobVector ? cosine(workerVector, jobVector) : null;
        const overlap = [...(jobKeywords.get(job.id) ?? [])].filter((word) => workerKeywords.has(word)).length;
        const titleOverlap = [...(jobTitleKeywords.get(job.id) ?? [])].filter((word) => workerKeywords.has(word)).length;
        // Without a profile vector, require a shared title word or several shared requirement words.
        const keywordFit = titleOverlap > 0 || overlap >= 2;
        const fits = sameClient || (similarity !== null ? similarity >= minimumSimilarity : keywordFit);
        const basis: SuggestionBasis = sameClient ? "SAME_CLIENT" : similarity !== null ? "PROFILE_MATCH" : "KEYWORDS";
        return { job, sameClient, similarity, overlap, titleOverlap, fits, basis };
      })
      .filter((entry) => entry.fits)
      .sort(
        (a, b) =>
          Number(b.sameClient) - Number(a.sameClient) ||
          (b.similarity ?? -1) - (a.similarity ?? -1) ||
          b.titleOverlap - a.titleOverlap ||
          b.overlap - a.overlap
      );

    items[employee.id] = {
      total: ranked.length,
      suggestions: ranked.slice(0, MAX_SUGGESTIONS_PER_WORKER).map(({ job, sameClient, similarity, basis }) => ({
        jobId: job.id,
        title: job.title,
        clientName: job.mrf?.client?.name ?? null,
        location: job.location ?? null,
        sameClient,
        basis,
        matchPercent: similarity !== null ? Math.round(Math.max(0, Math.min(1, similarity)) * 100) : null,
      })),
    };
  }

  return { items };
};
