import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import {
  KnnSettings,
  SCORING_DIMENSIONS,
  ScoringConfigurationInput,
  ScoringDimension,
  ScoringWeights,
} from "./scoring.types.js";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  SKILLS: 40,
  EXPERIENCE: 25,
  LOCATION: 15,
  COMPLIANCE: 10,
  EDUCATION_CERTIFICATIONS: 10,
};

export const DEFAULT_KNN_SETTINGS: KnnSettings = {
  defaultK: 20,
  maximumK: 100,
  minimumSimilarity: 0.5,
  includeArchived: true,
  excludeRejected: true,
  excludeCurrentlyHired: true,
};

export class InvalidScoringConfigurationError extends Error {
  readonly code = "INVALID_CONFIGURATION";
  constructor(readonly errors: Array<{ field: string; code: string; message: string }>) {
    super("Invalid candidate scoring configuration");
  }
}

const decimalToBasisPoints = (value: number): number | null => {
  if (!Number.isFinite(value) || value < 0) return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) return null;
  return Math.round(value * 10_000);
};

const validateScoringConfiguration = (
  input: ScoringConfigurationInput,
): { weights: ScoringWeights; knnSettings: KnnSettings } => {
  const errors: Array<{ field: string; code: string; message: string }> = [];
  const supplied = input?.weights;
  let total = 0;

  for (const dimension of SCORING_DIMENSIONS) {
    const value = supplied?.[dimension as ScoringDimension];
    const basisPoints = typeof value === "number" ? decimalToBasisPoints(value) : null;
    if (basisPoints === null) {
      errors.push({ field: `weights.${dimension}`, code: "INVALID_WEIGHT", message: "Weight must be a finite non-negative decimal with at most four decimal places." });
    } else {
      total += basisPoints;
    }
  }

  for (const key of Object.keys(supplied ?? {})) {
    if (!SCORING_DIMENSIONS.includes(key as ScoringDimension)) {
      errors.push({ field: `weights.${key}`, code: "UNKNOWN_DIMENSION", message: "Unknown scoring dimension." });
    }
  }

  if (total !== 1_000_000) {
    errors.push({ field: "weights", code: "WEIGHTS_MUST_TOTAL_100", message: "Dimension weights must total exactly 100%." });
  }

  const knnSettings: KnnSettings = { ...DEFAULT_KNN_SETTINGS, ...(input?.knnSettings ?? {}) };
  if (!Number.isInteger(knnSettings.defaultK) || knnSettings.defaultK < 1 || knnSettings.defaultK > knnSettings.maximumK) {
    errors.push({ field: "knnSettings.defaultK", code: "INVALID_K", message: "defaultK must be an integer between 1 and maximumK." });
  }
  if (!Number.isInteger(knnSettings.maximumK) || knnSettings.maximumK < 1 || knnSettings.maximumK > 100) {
    errors.push({ field: "knnSettings.maximumK", code: "INVALID_MAXIMUM_K", message: "maximumK must be an integer between 1 and 100." });
  }
  if (!Number.isFinite(knnSettings.minimumSimilarity) || knnSettings.minimumSimilarity < 0 || knnSettings.minimumSimilarity > 1) {
    errors.push({ field: "knnSettings.minimumSimilarity", code: "INVALID_MINIMUM_SIMILARITY", message: "minimumSimilarity must be between 0 and 1." });
  }
  for (const key of ["includeArchived", "excludeRejected", "excludeCurrentlyHired"] as const) {
    if (typeof knnSettings[key] !== "boolean") {
      errors.push({ field: `knnSettings.${key}`, code: "INVALID_BOOLEAN", message: `${key} must be a boolean.` });
    }
  }

  if (errors.length) throw new InvalidScoringConfigurationError(errors);
  return { weights: { ...supplied }, knnSettings };
};

const defaultScoringConfiguration = () =>
  validateScoringConfiguration({ weights: { ...DEFAULT_WEIGHTS }, knnSettings: { ...DEFAULT_KNN_SETTINGS } });

let cachedActiveConfig: any = null;

export class ConcurrentModificationError extends Error {
  readonly code = "CONCURRENT_MODIFICATION";
  constructor() { super("The scoring configuration changed before this update could be applied."); }
}

const serialize = (configuration: any) => ({
  id: configuration.id,
  scope: configuration.scope,
  status: configuration.status,
  version: configuration.version,
  revision: configuration.revision,
  weights: Object.fromEntries(configuration.weights.map((weight: any) => [weight.dimension, Number(weight.weight)])),
  knnSettings: configuration.knnSettings,
  createdAt: configuration.createdAt,
  activatedAt: configuration.activatedAt,
  createdBy: configuration.createdBy ? { id: configuration.createdBy.id, email: configuration.createdBy.email } : null,
  activatedBy: configuration.activatedBy ? { id: configuration.activatedBy.id, email: configuration.activatedBy.email } : null,
});

const include = {
  weights: true,
  createdBy: { select: { id: true, email: true } },
  activatedBy: { select: { id: true, email: true } },
} as const;

export const getActiveScoringConfiguration = async () => {
  if (cachedActiveConfig) return cachedActiveConfig;
  let configuration = await prisma.candidateScoringConfiguration.findFirst({ where: { scope: "GLOBAL", status: "ACTIVE" }, include });
  if (!configuration) {
    try {
      configuration = await prisma.candidateScoringConfiguration.create({
        data: {
          scope: "GLOBAL",
          status: "ACTIVE",
          version: 1,
          revision: 1,
          knnSettings: DEFAULT_KNN_SETTINGS,
          weights: { create: SCORING_DIMENSIONS.map((dimension: ScoringDimension) => ({ dimension, weight: new Prisma.Decimal(DEFAULT_WEIGHTS[dimension]) })) },
        },
        include,
      });
    } catch {
      configuration = await prisma.candidateScoringConfiguration.findFirstOrThrow({ where: { scope: "GLOBAL", status: "ACTIVE" }, include });
    }
  }
  cachedActiveConfig = serialize(configuration);
  return cachedActiveConfig;
};

export const validateConfigurationChange = (input: ScoringConfigurationInput) => validateScoringConfiguration(input);

const activateConfiguration = async (actorId: string, expectedRevision: number, input: ScoringConfigurationInput) => {
  const validated = validateScoringConfiguration(input);
  const created = await prisma.$transaction(async (tx) => {
    const active = await tx.candidateScoringConfiguration.findFirst({ where: { scope: "GLOBAL", status: "ACTIVE" }, include: { weights: true } });
    if (!active) throw new ConcurrentModificationError();
    const activatedAt = new Date();
    const superseded = await tx.candidateScoringConfiguration.updateMany({
      where: { id: active.id, status: "ACTIVE", revision: expectedRevision },
      data: { status: "SUPERSEDED", supersededAt: activatedAt, revision: { increment: 1 } },
    });
    if (superseded.count !== 1) throw new ConcurrentModificationError();
    await tx.candidateScore.updateMany({
      where: { configurationId: active.id, status: "CALCULATED" },
      data: { status: "STALE", staleAt: activatedAt },
    });
    const latest = await tx.candidateScoringConfiguration.aggregate({ _max: { version: true } });
    return tx.candidateScoringConfiguration.create({
      data: {
        scope: "GLOBAL",
        status: "ACTIVE",
        version: (latest._max.version ?? 0) + 1,
        revision: 1,
        knnSettings: validated.knnSettings,
        createdById: actorId,
        activatedById: actorId,
        weights: { create: SCORING_DIMENSIONS.map((dimension: ScoringDimension) => ({ dimension, weight: new Prisma.Decimal(validated.weights[dimension]) })) },
      },
      include,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  cachedActiveConfig = null;
  void revalidateConfiguration(created.id).catch((error) => console.error("[Scoring] failed to synchronously revalidate configuration", error));
  await logAudit(actorId, "CANDIDATE_SCORING_CONFIGURATION_ACTIVATED", "CandidateScoringConfiguration", created.id, { version: created.version });
  return serialize(created);
};

export const updateScoringConfiguration = (actorId: string, expectedRevision: number, input: ScoringConfigurationInput) =>
  activateConfiguration(actorId, expectedRevision, input);

export const restoreDefaultScoringConfiguration = (actorId: string, expectedRevision: number) =>
  activateConfiguration(actorId, expectedRevision, { weights: DEFAULT_WEIGHTS, knnSettings: DEFAULT_KNN_SETTINGS });

export const listScoringConfigurationHistory = async (cursor?: number, limit = 25) => {
  const configurations = await prisma.candidateScoringConfiguration.findMany({
    where: cursor ? { id: { lt: cursor } } : undefined,
    orderBy: { id: "desc" },
    take: limit + 1,
    include,
  });
  const hasMore = configurations.length > limit;
  const items = configurations.slice(0, limit).map(serialize);
  const nextCursor = hasMore && items.length ? items[items.length - 1].id : null;
  return { items, nextCursor };
};

// ─── REVALIDATION QUEUE & LOGIC ────────────────────────────────────────

import PQueue from "p-queue";
import { calculateAndPersistCandidateScore } from "./candidate-scoring.service.js";
import { rebuildCandidateFeatureProfile } from "./talent-pool-knn.service.js";

const revalidationQueue = new PQueue({ concurrency: 5 });

export const revalidateConfiguration = async (configurationId: number) => {
  const applications = await prisma.application.findMany({ select: { id: true, jobPostingId: true } });
  await revalidationQueue.addAll(applications.map((app) => async () => {
    await calculateAndPersistCandidateScore(app.id, app.jobPostingId, undefined, { forceNewCalculation: true, configurationId });
  }));
};

export const revalidateJobScoring = async (jobPostingId: number) => {
  const configuration = await prisma.candidateScoringConfiguration.findFirstOrThrow({ where: { scope: "GLOBAL", status: "ACTIVE" } });
  const applications = await prisma.application.findMany({ where: { jobPostingId }, select: { id: true } });
  await revalidationQueue.addAll(applications.map((app) => async () => {
    await calculateAndPersistCandidateScore(app.id, jobPostingId, undefined, { forceNewCalculation: true, configurationId: configuration.id });
  }));
};

export const revalidateApplication = async (applicationId: number, jobPostingId: number) => {
  const configuration = await prisma.candidateScoringConfiguration.findFirstOrThrow({ where: { scope: "GLOBAL", status: "ACTIVE" } });
  await calculateAndPersistCandidateScore(applicationId, jobPostingId, undefined, { forceNewCalculation: true, configurationId: configuration.id });
};

export const revalidateApplicantProfile = async (applicantProfileId: number) => {
  const configuration = await prisma.candidateScoringConfiguration.findFirstOrThrow({ where: { scope: "GLOBAL", status: "ACTIVE" } });
  await rebuildCandidateFeatureProfile(applicantProfileId);
  const profile = await prisma.applicantProfile.findUniqueOrThrow({ where: { id: applicantProfileId }, select: { userId: true } });
  const applications = await prisma.application.findMany({ where: { userId: profile.userId }, select: { id: true, jobPostingId: true } });
  await revalidationQueue.addAll(applications.map((app) => async () => {
    await calculateAndPersistCandidateScore(app.id, app.jobPostingId, undefined, { forceNewCalculation: true, configurationId: configuration.id });
  }));
};

export const getScoringRevalidationStatus = async () => {
  return {
    counts: { PENDING: revalidationQueue.size, PROCESSING: revalidationQueue.pending, COMPLETED: 0, FAILED: 0 },
    failures: []
  };
};
