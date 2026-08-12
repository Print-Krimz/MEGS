import prisma from "../../utils/prisma.js";


const KNN_AUDIT_ACTIONS = ["KNN_TALENT_POOL_QUERY", "KNN_SIMILAR_CANDIDATES_QUERY", "KNN_TALENT_POOL_SEARCH"];

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
  const [scoreStatuses, scoreAggregate, featureProfiles, applicantProfiles, verificationStates, classifiedAssets, telemetry] = await Promise.all([
    prisma.candidateScore.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.candidateScore.aggregate({ _avg: { finalFitScore: true }, _min: { finalFitScore: true }, _max: { finalFitScore: true } }),
    prisma.candidateFeatureProfile.count(),
    prisma.applicantProfile.count(),
    prisma.asset.groupBy({ by: ["verificationState"], _count: { _all: true } }),
    prisma.asset.count({ where: { documentType: { not: null } } }),
    prisma.auditLog.findMany({ where: { action: { in: KNN_AUDIT_ACTIONS }, createdAt: { gte: since } }, select: { details: true }, take: 1_000, orderBy: { createdAt: "desc" } }),
  ]);
  const latencySamples = telemetry.map((row) => parseLatency(row.details)).filter((value): value is number => value !== null);
  return {
    generatedAt: new Date(),
    dataWindowDays: 30,
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
