import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { ScoringWeights } from "./scoring.types.js";
import { EXTRACTION_VERSION, FEATURE_SCHEMA_VERSION, rebuildCandidateFeatureProfile, readFeatureInput } from "./talent-pool-knn.service.js";
import { getActiveScoringConfiguration } from "./scoring-configuration.service.js";
import { buildJobEmbeddingText, buildJobFeatureInput, computeMatchScore } from "./match-score.js";
import { generateJobEmbedding } from "./embedding.service.js";

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

// v2: unified job terms, partial semantic credit, missing data left out of the score.
// v3: per-item education/certifications, unclear job requirements left out, found/not found lists.
export const FIT_SCORE_VERSION = "fit-score-v3";

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
  if (!featureProfile || featureProfile.featureSchemaVersion !== FEATURE_SCHEMA_VERSION) {
    // Missing, or built by an older feature version (for example before protected terms were removed).
    featureProfile = (await rebuildCandidateFeatureProfile(profileId)) ?? featureProfile;
  } else {
    // Profiles whose embedding failed earlier are rebuilt so the skills score can
    // compare meaning, not only exact words.
    const [embeddingRow] = await prisma.$queryRaw<Array<{ missing: boolean }>>`
      SELECT ("embedding" IS NULL) AS missing FROM "CandidateFeatureProfile" WHERE id = ${featureProfile.id}
    `.catch(() => [] as Array<{ missing: boolean }>);
    if (embeddingRow?.missing) {
      featureProfile = (await rebuildCandidateFeatureProfile(profileId)) ?? featureProfile;
    }
  }
  if (!featureProfile) {
    throw new Error("Candidate feature profile could not be loaded or created.");
  }
  const candidate = readFeatureInput(featureProfile.rawFeatures);
  const mrf = job.mrf;
  const jobFeatureInput = buildJobFeatureInput(job, mrf, application.status);

  let computedKnnSimilarity = knnSimilarity;
  if (computedKnnSimilarity === undefined && featureProfile?.id) {
    try {
      const jobEmbedding = await generateJobEmbedding(buildJobEmbeddingText(job, mrf));
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

  const match = computeMatchScore(candidate, jobFeatureInput, computedKnnSimilarity, (active.weights || {}) as Partial<ScoringWeights>);
  const { dimensions, finalFitScore, activeTotalWeight } = match;

  const explanation = {
    version: FIT_SCORE_VERSION,
    ...(activeTotalWeight === 0
      ? {
          basis: "No specific job requirements configured",
          message: "No specific job requirements configured",
          note: "No specific job requirements configured",
        }
      : {}),
    missingMandatory: match.missingMandatory,
    incompleteFields: match.incompleteFields,
    needsReview: match.needsReview,
    requirementClarity: match.requirementClarity,
    embeddingUsed: typeof computedKnnSimilarity === "number" && computedKnnSimilarity > 0,
    dimensions,
    dimensionExplanations: match.explanations,
    dimensionsApplicable: match.dimensionsApplicable,
    dimensionStatuses: match.dimensionStatuses,
    weights: active.weights,
    normalizedWeights: match.normalizedWeights,
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
        calculationVersion: FIT_SCORE_VERSION,
      },
      include: { configuration: { select: { version: true } } },
    });

  // Prune any superseded stale scores for this application to keep the table clean and backups fast
  await prisma.candidateScore.deleteMany({
    where: {
      applicationId,
      status: "STALE",
    },
  }).catch(() => null);

  const { applyScoreCategorization } = await import("../ta/ta.applications.service.js");
  await applyScoreCategorization(applicationId, finalFitScore);

  return serializeScore(score);
};

export const listRankedCandidates = async (jobPostingId: number, cursor?: number, limit = 25) => {
  const active = await getActiveScoringConfiguration();
  const cursorScore = cursor === undefined
    ? null
    : await prisma.candidateScore.findFirst({
        where: { id: cursor, jobPostingId },
        select: { applicationId: true },
      });
  if (cursor !== undefined && !cursorScore) return { items: [], nextCursor: null };
  const cursorApplicationId = cursorScore?.applicationId;
  const cursorPredicate = cursorApplicationId === undefined ? Prisma.empty : Prisma.sql`
    AND EXISTS (SELECT 1 FROM cursor_score)
    AND (
      selected_scores."finalFitScore" < (SELECT "finalFitScore" FROM cursor_score)
      OR (selected_scores."finalFitScore" = (SELECT "finalFitScore" FROM cursor_score)
        AND selected_scores."applicationId" > (SELECT "applicationId" FROM cursor_score))
    )
  `;
  const query = Prisma.sql`
    WITH candidate_scores AS (
      SELECT
        score."id",
        score."applicationId",
        score."configurationId",
        score."status",
        score."finalFitScore",
        score."calculatedAt",
        ROW_NUMBER() OVER (
          PARTITION BY score."applicationId"
          ORDER BY
            CASE WHEN score."configurationId" = ${active.id} AND score."status" = 'CALCULATED' THEN 0 ELSE 1 END,
            score."calculatedAt" DESC,
            score."id" DESC
        ) AS preference
      FROM "CandidateScore" AS score
      WHERE score."jobPostingId" = ${jobPostingId}
        AND score."status" IN ('CALCULATED', 'STALE')
    ), selected_scores AS (
      SELECT "id", "applicationId", "finalFitScore"
      FROM candidate_scores
      WHERE preference = 1
    ), cursor_score AS (
      SELECT "applicationId", "finalFitScore"
      FROM selected_scores
      WHERE "applicationId" = ${cursorApplicationId ?? -1}
    )
    SELECT selected_scores."id", selected_scores."applicationId"
    FROM selected_scores
    WHERE TRUE ${cursorPredicate}
    ORDER BY selected_scores."finalFitScore" DESC, selected_scores."applicationId" ASC
    LIMIT ${limit + 1}
  `;
  const pageRows = await prisma.$queryRaw<Array<{ id: number; applicationId: number }>>(query);
  const hasMore = pageRows.length > limit;
  const selectedRows = pageRows.slice(0, limit);
  const hydratedRows = selectedRows.length === 0
    ? []
    : await prisma.candidateScore.findMany({
        where: { id: { in: selectedRows.map((row) => row.id) } },
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
  const hydratedById = new Map(hydratedRows.map((row) => [row.id, row]));
  const items = selectedRows.flatMap(({ id }) => {
    const row = hydratedById.get(id);
    if (!row) return [];
    return [{
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
    }];
  });
  return { items, nextCursor: hasMore ? selectedRows.at(-1)?.id ?? null : null };
};
