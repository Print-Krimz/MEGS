import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { getActiveScoringConfiguration } from "../scoring/scoring-configuration.service.js";
import { buildJobFeatureInput, computeMatchScore } from "../scoring/match-score.js";
import { readFeatureInput } from "../scoring/talent-pool-knn.service.js";
import type { ScoringWeights } from "../scoring/scoring.types.js";
import { OPEN_JOB_SELECT } from "./open-job-select.js";

/**
 * Personalised open jobs for one applicant.
 * Step 1 (shortlist): open jobs the applicant has not applied to or dismissed, with the vector
 * similarity between the stored job and profile vectors. No Gemini call happens here.
 * Step 2 (rank): the same rule-based match score TA screening uses, so skills, experience,
 * location and education all count and every result can be explained.
 */

export const PORTAL_MIN_SCORE = 40;
// shortcut: scores at most this many newest open jobs per request, add a vector index and a SQL shortlist past a few thousand open jobs.
const MAX_JOBS_SCORED = 200;
const DIGEST_KINDS = ["EMAILED", "SMS", "DISMISSED"];

// Same rule fetchJobDetails uses for "the applicant already has this job".
const liveApplicationWhere = (userId: string): Prisma.ApplicationWhereInput => ({
  userId,
  isArchived: false,
  OR: [
    { status: { notIn: ["BACKOUT", "ARCHIVED", "REJECTED", "DEPLOYED"] } },
    { deployments: { some: { status: { notIn: ["ENDED", "CANCELLED"] } } } },
  ],
});

const SCORING_MRF_FIELDS = {
  requiredSkills: true,
  requiredExperience: true,
  requiredEducation: true,
  requiredCertifications: true,
  complianceRequirements: true,
  complianceTemplates: { select: { documentLabel: true } },
} as const;

const JOB_SELECT = {
  ...OPEN_JOB_SELECT,
  mrf: { select: { ...OPEN_JOB_SELECT.mrf.select, ...SCORING_MRF_FIELDS } },
} satisfies Prisma.JobPostingSelect;

type ScoredJob = Prisma.JobPostingGetPayload<{ select: typeof JOB_SELECT }>;

export type RecommendedJob = {
  job: Omit<ScoredJob, "mrf"> & { mrf: ScoredJob["mrf"] extends infer M ? (M extends null ? null : Omit<NonNullable<M>, keyof typeof SCORING_MRF_FIELDS>) : never };
  /** Plain reasons shown to the applicant, at most two. */
  reasons: string[];
  /** Internal only. Applicants see reasons, not scores. */
  score: number;
};

export type RecommendationResult = { items: RecommendedJob[]; coldStart: boolean };

const publicJob = (job: ScoredJob): RecommendedJob["job"] => {
  if (!job.mrf) return { ...job, mrf: null };
  const { requiredSkills: _s, requiredExperience: _e, requiredEducation: _d, requiredCertifications: _c, complianceRequirements: _r, complianceTemplates: _t, ...mrf } = job.mrf;
  return { ...job, mrf };
};

const worksiteOf = (job: ScoredJob) => job.location || job.mrf?.location || "";

const buildReasons = (explanations: ReturnType<typeof computeMatchScore>["explanations"], statuses: ReturnType<typeof computeMatchScore>["dimensionStatuses"]) => {
  const reasons: string[] = [];
  const skills = explanations.SKILLS;
  const matched = skills?.matched?.length ?? 0;
  const listed = matched + (skills?.missing?.length ?? 0);
  if (statuses.SKILLS === "EVALUATED" && listed > 0 && matched > 0) {
    reasons.push(`Matches ${matched} of ${listed} listed skills`);
  }
  const place = explanations.LOCATION?.locationMatchedOn;
  if (statuses.LOCATION === "EVALUATED" && place) reasons.push(`Worksite in ${place}`);
  const experience = explanations.EXPERIENCE;
  if (statuses.EXPERIENCE === "EVALUATED" && experience?.requiredYears && (experience.candidateYears ?? 0) >= experience.requiredYears) {
    reasons.push(`Meets the ${experience.requiredYears}+ years of experience`);
  }
  return reasons.slice(0, 2);
};

const preferredTerms = (value: string | null | undefined) =>
  (value ?? "").split(/[,;\n]+/).map((term) => term.trim().toLowerCase()).filter((term) => term && term !== "remote");

export const recommendJobsForApplicant = async (
  userId: string,
  options: { limit?: number; forDigest?: boolean } = {},
): Promise<RecommendationResult> => {
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 50);
  const forDigest = options.forDigest === true;

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      isActive: true,
      expectedMonthlySalary: true,
      preferredWorkLocations: true,
      candidateFeatureProfile: { select: { rawFeatures: true } },
    },
  });
  if (!profile || !profile.isActive) return { items: [], coldStart: false };

  const [applied, events, configuration] = await Promise.all([
    prisma.application.findMany({ where: liveApplicationWhere(userId), select: { jobPostingId: true } }),
    prisma.jobRecommendationEvent.findMany({
      where: { userId, kind: { in: forDigest ? DIGEST_KINDS : ["DISMISSED"] } },
      select: { jobPostingId: true },
    }),
    getActiveScoringConfiguration(),
  ]);
  const excluded = [...new Set([...applied, ...events].map((row) => row.jobPostingId))];

  const jobs = await prisma.jobPosting.findMany({
    where: { status: "OPEN", ...(excluded.length ? { id: { notIn: excluded } } : {}) },
    orderBy: { createdAt: "desc" },
    take: MAX_JOBS_SCORED,
    select: JOB_SELECT,
  });
  if (jobs.length === 0) return { items: [], coldStart: false };

  const rawFeatures = profile.candidateFeatureProfile?.rawFeatures;
  const salary = profile.expectedMonthlySalary;
  // A job whose top pay is below what the applicant expects goes last in the portal and never into the digest.
  const belowSalary = (job: ScoredJob) =>
    salary != null && job.mrf?.salaryRangeMax != null && job.mrf.salaryRangeMax < salary;

  if (!rawFeatures) {
    // Cold start: no profile data to score, so show the newest jobs, narrowed to preferred areas when they match any.
    if (forDigest) return { items: [], coldStart: true };
    const terms = preferredTerms(profile.preferredWorkLocations);
    const inArea = terms.length ? jobs.filter((job) => terms.some((term) => worksiteOf(job).toLowerCase().includes(term))) : [];
    const pool = inArea.length ? inArea : jobs;
    const items = pool.filter((job) => !belowSalary(job)).slice(0, limit).map((job) => ({
      job: publicJob(job),
      reasons: inArea.length ? ["Worksite in your preferred area"] : [],
      score: 0,
    }));
    return { items, coldStart: true };
  }

  const similarities = new Map<number, number>();
  const rows = await prisma.$queryRaw<Array<{ id: number; similarity: number | null }>>`
    SELECT jp."id", 1 - (jp."embedding" <=> cfp."embedding") AS "similarity"
    FROM "JobPosting" jp
    JOIN "CandidateFeatureProfile" cfp ON cfp."applicantProfileId" = ${profile.id}
    WHERE jp."id" IN (${Prisma.join(jobs.map((job) => job.id))})
      AND jp."embedding" IS NOT NULL AND cfp."embedding" IS NOT NULL
  `;
  for (const row of rows) if (row.similarity != null) similarities.set(row.id, Number(row.similarity));

  const candidate = readFeatureInput(rawFeatures);
  const weights = (configuration.weights ?? {}) as Partial<ScoringWeights>;
  const threshold = forDigest ? Number(configuration.matchThreshold) : PORTAL_MIN_SCORE;

  const scored = jobs
    .map((job) => {
      const similarity = similarities.get(job.id);
      const match = computeMatchScore(candidate, buildJobFeatureInput(job, job.mrf, null), similarity, weights);
      return { job, similarity: similarity ?? -1, score: match.finalFitScore, reasons: buildReasons(match.explanations, match.dimensionStatuses) };
    })
    .filter((item) => item.score >= threshold && !(forDigest && belowSalary(item.job)));

  scored.sort(
    (a, b) =>
      Number(belowSalary(a.job)) - Number(belowSalary(b.job)) ||
      b.score - a.score ||
      b.similarity - a.similarity ||
      b.job.createdAt.getTime() - a.job.createdAt.getTime(),
  );

  return {
    items: scored.slice(0, limit).map(({ job, reasons, score }) => ({ job: publicJob(job), reasons, score })),
    coldStart: false,
  };
};

export const dismissRecommendation = async (userId: string, jobPostingId: number) => {
  await prisma.jobRecommendationEvent.upsert({
    where: { userId_jobPostingId_kind: { userId, jobPostingId, kind: "DISMISSED" } },
    create: { userId, jobPostingId, kind: "DISMISSED" },
    update: {},
  });
  return { dismissed: true };
};

export const undoDismissRecommendation = async (userId: string, jobPostingId: number) => {
  await prisma.jobRecommendationEvent.deleteMany({ where: { userId, jobPostingId, kind: "DISMISSED" } });
  return { dismissed: false };
};
