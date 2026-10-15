import { z } from "zod";
import { FIELD_LIMITS, finiteNumber } from "./field-limits.js";

const positiveId = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });
const queryBoolean = z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]);

const weights = z.object({
  SKILLS: z.number().finite().min(0).max(100),
  EXPERIENCE: z.number().finite().min(0).max(100),
  LOCATION: z.number().finite().min(0).max(100),
  COMPLIANCE: z.number().finite().min(0).max(100),
  EDUCATION_CERTIFICATIONS: z.number().finite().min(0).max(100),
}).strict();

const knnSettings = z.object({
  defaultK: z.number().finite().int().min(1).max(100).optional(),
  maximumK: z.number().finite().int().min(1).max(100).optional(),
  minimumSimilarity: z.number().finite().min(0).max(1).refine((value) => Number(value.toFixed(4)) === value, "Similarity supports up to 4 decimal places").optional(),
  includeArchived: z.boolean().optional(),
  excludeRejected: z.boolean().optional(),
  excludeCurrentlyHired: z.boolean().optional(),
}).strict();

export const candidateScoringSchema = {
  configuration: z.object({
    expectedRevision: positiveId,
    weights: weights.refine((value) => Object.values(value).every((number) => Number(number.toFixed(2)) === number), "Weights support up to 2 decimal places"),
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().finite().int().min(0).max(100).optional(),
  }).strict(),
  validateConfiguration: z.object({
    weights: weights.refine((value) => Object.values(value).every((number) => Number(number.toFixed(2)) === number), "Weights support up to 2 decimal places"),
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().finite().int().min(0).max(100).optional(),
  }).strict(),
  restoreDefaults: z.object({ expectedRevision: positiveId }).strict(),
  cursorQuery: z.object({ cursor: positiveId.optional(), limit: z.union([z.number().finite().int().min(1).max(100), z.string().regex(/^[0-9]{1,3}$/).transform(Number).refine((value) => value >= 1 && value <= 100)]).default(25) }).strict(),
  rankJobParams: z.object({ jobId: positiveId }).strict(),
  talentPoolQuery: z.object({
    k: z.union([z.number().finite().int().min(1).max(100), z.string().regex(/^[0-9]{1,3}$/).transform(Number).refine((value) => value >= 1 && value <= 100)]).optional(),
    includeArchived: queryBoolean.optional(),
  }).strict(),
  talentPoolSearch: z.object({
    jobId: positiveId.optional(),
    candidateId: positiveId.optional(),
    text: z.string().trim().min(2).max(200).optional(),
    k: z.number().finite().int().min(1).max(100).optional(),
  }).strict().refine((value) => Boolean(value.jobId || value.candidateId || value.text), { message: "Provide jobId, candidateId, or text." }),
  addToTalentPool: z.object({
    applicantProfileId: positiveId,
    sourceApplicationId: positiveId.optional(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
  recordContact: z.object({
    membershipId: positiveId,
    jobPostingId: positiveId,
    outcome: z.enum(["INTERESTED", "NOT_INTERESTED", "NO_RESPONSE", "UNAVAILABLE"]),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
  considerForJob: z.object({
    applicantProfileId: positiveId,
    targetJobId: positiveId,
    notes: z.string().trim().max(1000).optional(),
    contactOutcome: z.enum(["INTERESTED", "NOT_INTERESTED", "NO_RESPONSE", "UNAVAILABLE"]).optional(),
  }).strict(),
};

export const candidateScoringRouteSchema = {
  rankJob: z.object({ params: candidateScoringSchema.rankJobParams }),
  rankedCandidates: z.object({
    params: candidateScoringSchema.rankJobParams,
    query: candidateScoringSchema.cursorQuery,
  }),
  talentPool: z.object({
    params: candidateScoringSchema.rankJobParams,
    query: candidateScoringSchema.talentPoolQuery,
  }),
  similarCandidates: z.object({
    params: z.object({ candidateId: positiveId }).strict(),
    query: candidateScoringSchema.talentPoolQuery,
  }),
  searchTalentPool: z.object({ body: candidateScoringSchema.talentPoolSearch }),
  addCandidate: z.object({ body: candidateScoringSchema.addToTalentPool }),
  recordContact: z.object({ body: candidateScoringSchema.recordContact }),
  considerCandidate: z.object({ body: candidateScoringSchema.considerForJob }),
};
