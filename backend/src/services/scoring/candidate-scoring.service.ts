import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { ScoringDimension, ScoringWeights } from "./scoring.types.js";
import { EXTRACTION_VERSION, FEATURE_SCHEMA_VERSION, rebuildCandidateFeatureProfile, readFeatureInput } from "./talent-pool-knn.service.js";
import { getActiveScoringConfiguration } from "./scoring-configuration.service.js";
import { calculateFitDimensions, clampScore } from "./scoring.dimensions.js";

type CompletedOrStaleCandidateScore = {
  applicationId: number;
  configurationId: number;
  status: string;
};

const selectCurrentOrFallbackScores = <T extends CompletedOrStaleCandidateScore>(
  rows: T[],
  activeConfigurationId: number,
) => {
  const selected = new Map<number, T>();
  for (const row of rows) {
    const current = selected.get(row.applicationId);
    const isActiveCalculation = row.configurationId === activeConfigurationId && row.status === "CALCULATED";
    const currentIsActiveCalculation = current !== undefined
      && current.configurationId === activeConfigurationId
      && current.status === "CALCULATED";
    if (!current || (isActiveCalculation && !currentIsActiveCalculation)) selected.set(row.applicationId, row);
  }
  return [...selected.values()];
};

const serializeScore = (score: any) => ({
  id: score.id,
  applicationId: score.applicationId,
  jobPostingId: score.jobPostingId,
  configurationVersion: score.configuration?.version ?? score.configurationVersion,
  configurationId: score.configurationId,
  status: score.status,
  calculatedAt: score.calculatedAt,
  skillsScore: Number(score.skillsScore),
  experienceScore: Number(score.experienceScore),
  locationScore: Number(score.locationScore),
  complianceScore: Number(score.complianceScore),
  educationCertificationScore: Number(score.educationCertificationScore),
  finalFitScore: Number(score.finalFitScore),
  knnSimilarity: score.knnSimilarity === null || score.knnSimilarity === undefined ? null : Number(score.knnSimilarity),
  breakdown: {
    skills: Number(score.skillsScore),
    experience: Number(score.experienceScore),
    location: Number(score.locationScore),
    compliance: Number(score.complianceScore),
    educationCertifications: Number(score.educationCertificationScore),
  },
  explanation: score.explanation,
});

export const calculateAndPersistCandidateScore = async (
  applicationId: number,
  jobPostingId: number,
  knnSimilarity?: number,
  options: { forceNewCalculation?: boolean; configurationId?: number } = {},
) => {
  const active = options.configurationId
    ? await prisma.candidateScoringConfiguration.findUniqueOrThrow({
        where: { id: options.configurationId },
        include: { weights: true },
      }).then((configuration) => ({
        id: configuration.id,
        version: configuration.version,
        weights: Object.fromEntries(configuration.weights.map((weight) => [weight.dimension, Number(weight.weight)])) as ScoringWeights,
      }))
    : await getActiveScoringConfiguration();
  const existing = await prisma.candidateScore.findFirst({
    where: { applicationId, jobPostingId, configurationId: active.id, status: "CALCULATED" },
    orderBy: { calculatedAt: "desc" },
    include: { configuration: { select: { version: true } } },
  });
  if (existing && !options.forceNewCalculation) return serializeScore(existing);

  const [application, job] = await Promise.all([
    prisma.application.findUniqueOrThrow({ where: { id: applicationId }, include: { user: { include: { applicantProfile: { select: { id: true } } } } } }),
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
  ]);
  const profileId = application.user.applicantProfile?.id;
  if (!profileId) throw new Error("Candidate profile is required before a deterministic score can be calculated.");
  const featureProfile = await rebuildCandidateFeatureProfile(profileId);
  const candidate = readFeatureInput(featureProfile.rawFeatures);
  const dimensionCalculation = calculateFitDimensions(candidate, { title: job.title, requirements: job.requirements, location: job.location });
  const dimensions = dimensionCalculation.scores;
  const weights = active.weights as ScoringWeights;
  const finalFitScore = clampScore(Object.entries(dimensions).reduce((sum, [dimension, raw]) => sum + raw * weights[dimension as ScoringDimension] / 100, 0));
  const explanation = {
    version: "fit-score-v1",
    missingMandatory: dimensionCalculation.missingMandatory,
    dimensions,
    dimensionExplanations: dimensionCalculation.explanations,
    weights,
    protectedAttributesExcluded: true,
  };
  const score = await prisma.candidateScore.create({
      data: {
        applicationId,
        jobPostingId,
        configurationId: active.id,
        skillsScore: new Prisma.Decimal(dimensions.SKILLS),
        experienceScore: new Prisma.Decimal(dimensions.EXPERIENCE),
        locationScore: new Prisma.Decimal(dimensions.LOCATION),
        complianceScore: new Prisma.Decimal(dimensions.COMPLIANCE),
        educationCertificationScore: new Prisma.Decimal(dimensions.EDUCATION_CERTIFICATIONS),
        finalFitScore: new Prisma.Decimal(finalFitScore),
        knnSimilarity: knnSimilarity === undefined ? null : new Prisma.Decimal(knnSimilarity),
        explanation: explanation as Prisma.InputJsonValue,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        extractionVersion: EXTRACTION_VERSION,
        calculationVersion: "fit-score-v1",
      },
      include: { configuration: { select: { version: true } } },
    });

  const { applyScoreCategorization } = await import("../ta/ta.applications.service.js");
  await applyScoreCategorization(applicationId, finalFitScore);

  return serializeScore(score);
};

export const listRankedCandidates = async (jobPostingId: number, cursor?: number, limit = 25) => {
  const active = await getActiveScoringConfiguration();
  const rows = await prisma.candidateScore.findMany({
    where: { jobPostingId, status: { in: ["CALCULATED", "STALE"] }, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: [{ calculatedAt: "desc" }, { id: "desc" }],
    include: {
      configuration: { select: { version: true } },
      application: {
        select: {
          status: true,
          user: {
            select: {
              id: true,
              email: true,
              applicantProfile: { select: { firstName: true, lastName: true, city: true, province: true } },
            },
          },
        },
      },
    },
  });
  const latestRows = selectCurrentOrFallbackScores(rows, active.id)
    .sort((left, right) => Number(right.finalFitScore) - Number(left.finalFitScore) || left.applicationId - right.applicationId);
  const hasMore = latestRows.length > limit;
  const items = latestRows.slice(0, limit).map((row) => ({ ...serializeScore(row), candidate: row.application.user.applicantProfile ? { id: row.application.user.id, email: row.application.user.email, ...row.application.user.applicantProfile, applicationStatus: row.application.status } : null }));
  return { items, nextCursor: hasMore ? latestRows[limit - 1]?.id ?? null : null };
};
