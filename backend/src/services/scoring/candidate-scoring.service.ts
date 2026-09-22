import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { SCORING_DIMENSIONS, ScoringDimension, ScoringWeights, JobFeatureInput } from "./scoring.types.js";
import { EXTRACTION_VERSION, FEATURE_SCHEMA_VERSION, rebuildCandidateFeatureProfile, readFeatureInput } from "./talent-pool-knn.service.js";
import { getActiveScoringConfiguration, DEFAULT_WEIGHTS } from "./scoring-configuration.service.js";
import { calculateFitDimensions, clampScore, requiredYearsFromText } from "./scoring.dimensions.js";
import { generateEmbedding } from "./embedding.service.js";

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
  dimensionsApplicable: score.explanation?.dimensionsApplicable,
  dimensionStatuses: score.explanation?.dimensionStatuses,
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
    prisma.jobPosting.findUniqueOrThrow({
      where: { id: jobPostingId },
      include: {
        mrf: {
          include: {
            complianceTemplates: true,
          },
        },
      },
    }),
  ]);
  const profileId = application.user.applicantProfile?.id;
  if (!profileId) throw new Error("Candidate profile is required before a deterministic score can be calculated.");
  let featureProfile = await prisma.candidateFeatureProfile.findUnique({
    where: { applicantProfileId: profileId },
  });
  if (!featureProfile) {
    featureProfile = await rebuildCandidateFeatureProfile(profileId);
  }
  if (!featureProfile) {
    throw new Error("Candidate feature profile could not be loaded or created.");
  }
  const candidate = readFeatureInput(featureProfile.rawFeatures);
  const mrf = (job as any).mrf;
  const splitList = (val?: string | null) =>
    val ? val.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean) : undefined;

  const jobFeatureInput: JobFeatureInput = {
    title: job.title,
    requirements: job.requirements,
    location: job.location ?? mrf?.location ?? null,
    requiredSkills: splitList(mrf?.requiredSkills),
    requiredYearsExperience: mrf?.requiredExperience
      ? requiredYearsFromText(mrf.requiredExperience)
      : undefined,
    requiredEducation: splitList(mrf?.requiredEducation),
    requiredCertifications: splitList(mrf?.requiredCertifications),
    requiredComplianceDocuments: mrf?.complianceTemplates?.length
      ? mrf.complianceTemplates.map((t: any) => t.documentLabel)
      : splitList(mrf?.complianceRequirements),
    applicationStage: application.status,
  };

  let computedKnnSimilarity = knnSimilarity;
  if (computedKnnSimilarity === undefined && featureProfile?.id) {
    try {
      const jobText = [job.title, job.requirements, mrf?.requiredSkills, mrf?.requiredExperience].filter(Boolean).join(" ");
      const jobEmbedding = await generateEmbedding(jobText, { taskType: "RETRIEVAL_QUERY" });
      const vectorStr = `[${jobEmbedding.join(",")}]`;
      const vectorResults = await prisma.$queryRaw<Array<{ similarity: number }>>`
        SELECT (1 - ("embedding" <=> ${vectorStr}::vector)) AS similarity
        FROM "CandidateFeatureProfile"
        WHERE id = ${featureProfile.id} AND "embedding" IS NOT NULL
      `;
      if (vectorResults.length > 0 && vectorResults[0].similarity !== null) {
        computedKnnSimilarity = Math.max(0, Math.min(1, Number(vectorResults[0].similarity)));
      }
    } catch {
      // Graceful fallback when pgvector is unavailable or in offline test environments
    }
  }

  const dimensionCalculation = calculateFitDimensions(candidate, jobFeatureInput, computedKnnSimilarity);
  const dimensions = dimensionCalculation.scores;
  const weights = (active.weights || {}) as Partial<ScoringWeights>;

  // Determine which dimensions are applicable (isApplicable === true and dimensionStatus === "EVALUATED")
  const applicableDimensions = SCORING_DIMENSIONS.filter((dim) => {
    return (
      dimensionCalculation.dimensionsApplicable[dim] === true &&
      dimensionCalculation.dimensionStatuses[dim] === "EVALUATED"
    );
  });

  // Calculate activeTotalWeight = sum(configured weights of applicable dimensions)
  const activeTotalWeight = applicableDimensions.reduce((sum, dim) => {
    const rawWeight = Number(weights[dim]);
    const dimWeight = Number.isFinite(rawWeight) ? rawWeight : (DEFAULT_WEIGHTS[dim] ?? 0);
    return sum + dimWeight;
  }, 0);

  let finalFitScore: number;
  const normalizedWeights: Record<ScoringDimension, number> = {} as any;

  if (activeTotalWeight > 0) {
    let rawFitScore = 0;
    for (const dim of SCORING_DIMENSIONS) {
      if (applicableDimensions.includes(dim)) {
        const rawWeight = Number(weights[dim]);
        const dimWeight = Number.isFinite(rawWeight) ? rawWeight : (DEFAULT_WEIGHTS[dim] ?? 0);
        const normalizedWeight = (dimWeight / activeTotalWeight) * 100;
        normalizedWeights[dim] = clampScore(normalizedWeight);
        const dimScore = typeof dimensions[dim] === "number" && Number.isFinite(dimensions[dim]) ? dimensions[dim] : 0;
        rawFitScore += (dimScore * normalizedWeight) / 100;
      } else {
        normalizedWeights[dim] = 0;
      }
    }
    finalFitScore = clampScore(rawFitScore);
  } else {
    for (const dim of SCORING_DIMENSIONS) {
      normalizedWeights[dim] = 0;
    }
    finalFitScore = 50;
  }

  const explanation = {
    version: "fit-score-v1",
    ...(activeTotalWeight === 0
      ? {
          basis: "No specific job requirements configured",
          message: "No specific job requirements configured",
          note: "No specific job requirements configured",
        }
      : {}),
    missingMandatory: dimensionCalculation.missingMandatory,
    dimensions,
    dimensionExplanations: dimensionCalculation.explanations,
    dimensionsApplicable: dimensionCalculation.dimensionsApplicable,
    dimensionStatuses: dimensionCalculation.dimensionStatuses,
    weights: active.weights,
    normalizedWeights,
    activeTotalWeight,
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
        knnSimilarity: computedKnnSimilarity === undefined ? null : new Prisma.Decimal(computedKnnSimilarity),
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
  const items = latestRows.slice(0, limit).map((row) => ({
    ...serializeScore(row),
    candidate: {
      id: row.application.user.id,
      email: row.application.user.email,
      firstName: row.application.user.applicantProfile?.firstName ?? null,
      lastName: row.application.user.applicantProfile?.lastName ?? null,
      city: row.application.user.applicantProfile?.city ?? null,
      province: row.application.user.applicantProfile?.province ?? null,
      applicationStatus: row.application.status,
    },
  }));
  return { items, nextCursor: hasMore ? latestRows[limit - 1]?.id ?? null : null };
};
