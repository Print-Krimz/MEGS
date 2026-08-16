import { z } from "zod";

const weights = z.object({
  SKILLS: z.number().nonnegative(),
  EXPERIENCE: z.number().nonnegative(),
  LOCATION: z.number().nonnegative(),
  COMPLIANCE: z.number().nonnegative(),
  EDUCATION_CERTIFICATIONS: z.number().nonnegative(),
}).strict();

const knnSettings = z.object({
  defaultK: z.number().int().min(1).max(100).optional(),
  maximumK: z.number().int().min(1).max(100).optional(),
  minimumSimilarity: z.number().min(0).max(1).optional(),
  includeArchived: z.boolean().optional(),
  excludeRejected: z.boolean().optional(),
  excludeCurrentlyHired: z.boolean().optional(),
}).strict();

export const candidateScoringSchema = {
  configuration: z.object({
    expectedRevision: z.number().int().min(1),
    weights,
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().int().min(0).max(100).optional(),
  }).strict(),
  validateConfiguration: z.object({
    weights,
    knnSettings: knnSettings.optional(),
    matchThreshold: z.number().int().min(0).max(100).optional(),
  }).strict(),
  restoreDefaults: z.object({ expectedRevision: z.number().int().min(1) }).strict(),
  cursorQuery: z.object({ cursor: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(100).default(25) }),
  rankJobParams: z.object({ jobId: z.coerce.number().int().positive() }),
  talentPoolQuery: z.object({
    k: z.coerce.number().int().min(1).max(100).optional(),
    includeArchived: z.coerce.boolean().optional(),
  }),
  talentPoolSearch: z.object({
    jobId: z.number().int().positive().optional(),
    candidateId: z.number().int().positive().optional(),
    text: z.string().trim().min(2).max(10_000).optional(),
    k: z.number().int().min(1).max(100).optional(),
  }).refine((value) => Boolean(value.jobId || value.candidateId || value.text), { message: "Provide jobId, candidateId, or text." }),
  addToTalentPool: z.object({
    applicantProfileId: z.number().int().positive(),
    sourceApplicationId: z.number().int().positive().optional(),
    availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNKNOWN"]).optional(),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
  recordContact: z.object({
    membershipId: z.number().int().positive(),
    jobPostingId: z.number().int().positive(),
    outcome: z.enum(["INTERESTED", "NOT_INTERESTED", "NO_RESPONSE", "UNAVAILABLE"]),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
  considerForJob: z.object({
    applicantProfileId: z.number().int().positive(),
    targetJobId: z.number().int().positive(),
    notes: z.string().trim().max(1000).optional(),
    contactOutcome: z.enum(["INTERESTED", "NOT_INTERESTED", "NO_RESPONSE", "UNAVAILABLE"]).optional(),
  }).strict(),
};
