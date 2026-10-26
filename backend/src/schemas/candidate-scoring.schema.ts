import { z } from "zod";
import { FIELD_LIMITS, finiteNumber } from "./field-limits.js";

const positiveId = finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true });

const WEIGHT_MESSAGE = "Weights must be whole numbers from 0 to 100.";
const weight = z.number(WEIGHT_MESSAGE).int(WEIGHT_MESSAGE).min(0, WEIGHT_MESSAGE).max(100, WEIGHT_MESSAGE);
const weights = z.object({
  SKILLS: weight,
  EXPERIENCE: weight,
  LOCATION: weight,
  COMPLIANCE: weight,
  EDUCATION_CERTIFICATIONS: weight,
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
    weights,
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().finite().int().min(0).max(100).optional(),
  }).strict(),
  validateConfiguration: z.object({
    weights,
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().finite().int().min(0).max(100).optional(),
  }).strict(),
  restoreDefaults: z.object({ expectedRevision: positiveId }).strict(),
  cursorQuery: z.object({ cursor: positiveId.optional(), limit: z.union([z.number().finite().int().min(1).max(100), z.string().regex(/^[0-9]{1,3}$/).transform(Number).refine((value) => value >= 1 && value <= 100)]).default(25) }).strict(),
  rankJobParams: z.object({ jobId: positiveId }).strict(),
  talentPoolQuery: z.object({
    k: z.union([z.number().finite().int().min(1).max(100), z.string().regex(/^[0-9]{1,3}$/).transform(Number).refine((value) => value >= 1 && value <= 100)]).optional(),
  }).strict(),
  talentPoolSearch: z.object({
    jobId: positiveId.optional(),
    candidateId: positiveId.optional(),
    text: z.string().trim().min(2).max(200).optional(),
    k: z.number().finite().int().min(1).max(100).optional(),
  }).strict()
    .refine((value) => Boolean(value.jobId || value.candidateId || value.text), { message: "Provide jobId, candidateId, or text." })
    // One kind of search at a time; a job search would otherwise silently ignore the text.
    .refine((value) => [value.jobId, value.candidateId, value.text].filter(Boolean).length === 1, { message: "Search by a job, a candidate, or words, not more than one." }),
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
