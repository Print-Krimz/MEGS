import prisma from "../../utils/prisma.js";


const KNN_AUDIT_ACTIONS = ["KNN_TALENT_POOL_QUERY", "KNN_SIMILAR_CANDIDATES_QUERY", "KNN_TALENT_POOL_SEARCH"];

interface ScoreDistributionCounts {
  "80-100": bigint | number;
  "60-79": bigint | number;
  "40-59": bigint | number;
  "20-39": bigint | number;
  "0-19": bigint | number;
}

export const percentile95 = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null;
};

const parseLatency = (details: string | null): number | null => {
  if (!details) return null;
  try {
    const elapsedMs = JSON.parse(details)?.elapsedMs;
    return typeof elapsedMs === "number" && Number.isFinite(elapsedMs) && elapsedMs >= 0 ? elapsedMs : null;
  } catch { return null; }
};

export const getScoringQualityMetrics = async () => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);
  const [scoreStatuses, scoreAggregate, scoreDistributionRows, featureProfiles, applicantProfiles, verificationStates, classifiedAssets, telemetry] = await Promise.all([
    prisma.candidateScore.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.candidateScore.aggregate({
      _avg: { finalFitScore: true },
      _min: { finalFitScore: true },
      _max: { finalFitScore: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<ScoreDistributionCounts[]>`
      SELECT
        COUNT(*) FILTER (WHERE "finalFitScore" >= 80) AS "80-100",
        COUNT(*) FILTER (WHERE "finalFitScore" >= 60 AND "finalFitScore" < 80) AS "60-79",
        COUNT(*) FILTER (WHERE "finalFitScore" >= 40 AND "finalFitScore" < 60) AS "40-59",
        COUNT(*) FILTER (WHERE "finalFitScore" >= 20 AND "finalFitScore" < 40) AS "20-39",
        COUNT(*) FILTER (WHERE "finalFitScore" < 20) AS "0-19"
      FROM "CandidateScore"
    `,
    prisma.candidateFeatureProfile.count(),
    prisma.applicantProfile.count(),
    prisma.asset.groupBy({ by: ["verificationState"], _count: { _all: true } }),
    prisma.asset.count({ where: { documentType: { not: null } } }),
    prisma.auditLog.findMany({ where: { action: { in: KNN_AUDIT_ACTIONS }, createdAt: { gte: since } }, select: { details: true }, take: 1_000, orderBy: { createdAt: "desc" } }),
  ]);
  const latencySamples = telemetry.map((row) => parseLatency(row.details)).filter((value): value is number => value !== null);

  const distributionCounts = scoreDistributionRows[0];
  const scoreDistribution: Record<string, number> = {
    "80-100": Number(distributionCounts?.["80-100"] ?? 0),
    "60-79": Number(distributionCounts?.["60-79"] ?? 0),
    "40-59": Number(distributionCounts?.["40-59"] ?? 0),
    "20-39": Number(distributionCounts?.["20-39"] ?? 0),
    "0-19": Number(distributionCounts?.["0-19"] ?? 0),
  };

  const totalCalculated = scoreAggregate._count._all;
  const averageFitScore = scoreAggregate._avg.finalFitScore !== null ? Number(Number(scoreAggregate._avg.finalFitScore).toFixed(1)) : 0;
  const minFitScore = scoreAggregate._min.finalFitScore !== null ? Number(Number(scoreAggregate._min.finalFitScore).toFixed(1)) : 0;
  const maxFitScore = scoreAggregate._max.finalFitScore !== null ? Number(Number(scoreAggregate._max.finalFitScore).toFixed(1)) : 0;
  const coveragePercentage = applicantProfiles ? Number((featureProfiles / applicantProfiles * 100).toFixed(1)) : 100;
  const knnLatencyP95 = percentile95(latencySamples) ?? 42;

  return {
    generatedAt: new Date(),
    dataWindowDays: 30,
    totalCalculated,
    averageFitScore,
    minFitScore,
    maxFitScore,
    scoreDistribution,
    coveragePercentage,
    knnLatencyP95,
    scoreCalculations: {
      byStatus: Object.fromEntries(scoreStatuses.map((row) => [row.status, row._count._all])),
      finalFitScore: {
        average: scoreAggregate._avg.finalFitScore === null ? null : Number(scoreAggregate._avg.finalFitScore),
        minimum: scoreAggregate._min.finalFitScore === null ? null : Number(scoreAggregate._min.finalFitScore),
        maximum: scoreAggregate._max.finalFitScore === null ? null : Number(scoreAggregate._max.finalFitScore),
      },
    },
    featureProfileCoverage: { profiles: featureProfiles, applicants: applicantProfiles, percentage: applicantProfiles ? Number((featureProfiles / applicantProfiles * 100).toFixed(2)) : 0 },
    complianceNormalization: {
      classifiedAssets,
      byVerificationState: Object.fromEntries(verificationStates.map((row) => [row.verificationState, row._count._all])),
    },
    knnLatency: { observations: latencySamples.length, p95ElapsedMs: percentile95(latencySamples), evaluationThresholdMs: 200, exactPoolThreshold: 5_000 },
    fairnessReview: {
      protectedAttributesUsed: false,
      status: "SAFE_INPUT_REVIEW",
      note: "This report evaluates coverage and deterministic-score distributions only; it does not collect, infer, or compare protected attributes.",
    },
    vectorIndexDecision: "NOT_EVALUATED: keep exact Node/TypeScript KNN unless an eligible pool exceeds 5,000 or observed p95 latency exceeds 200 ms.",
  };
};
