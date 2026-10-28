import { z } from "zod";
import { boundedId, boundedText, boundedPageSize, finiteNumber, safeProseSchema, FIELD_LIMITS } from "./field-limits.js";
import { APPLICANT_SELF_WITHDRAW_REASONS } from "../services/ta/backout-rules.js";
import { talentPoolInvitationSchema } from "./talent-pool-invitation.schema.js";
import { listSavedJobsQuerySchema } from "./applicant.schema.js";

const APPLICANT_REASONS = APPLICANT_SELF_WITHDRAW_REASONS as unknown as [string, ...string[]];
const idParams = z.object({ id: boundedId }).strict();

export const applicantApplicationSchema = {
  listJobs: z.object({
    query: z.object({
      search: boundedText(FIELD_LIMITS.search).optional(),
      location: boundedText(FIELD_LIMITS.shortText).optional(),
      salaryMin: finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional(),
      salaryMax: finiteNumber({ min: 0, max: 1_000_000, decimals: 2 }).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: boundedPageSize.optional(),
    }).strict().refine(
      (query) => query.salaryMin === undefined || query.salaryMax === undefined || query.salaryMin <= query.salaryMax,
      { message: "Minimum salary cannot be higher than maximum salary", path: ["salaryMin"] },
    ),
  }),
  employerSummary: z.object({ query: z.object({}).strict() }),
  myApplications: z.object({
    query: z.object({
      summary: z.enum(["true", "false"]).optional(),
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: boundedPageSize.optional(),
    }).strict(),
  }),
  listSavedJobs: z.object({ query: listSavedJobsQuerySchema }),
  jobParams: z.object({ params: idParams }),
  applyParams: z.object({ params: idParams }),
  apply: z.object({ params: idParams, body: z.object({}).strict().optional() }),
  withdraw: z.object({
    params: idParams,
    body: z.object({
      reason: z.enum(APPLICANT_REASONS),
      notes: boundedText(FIELD_LIMITS.notes).optional(),
    }).strict().superRefine((body, ctx) => {
      if (body.reason === "OTHER" && !body.notes) {
        ctx.addIssue({ code: "custom", path: ["notes"], message: "Please describe the reason." });
      }
    }),
  }),
  rescheduleRequest: z.object({
    params: idParams,
    body: z.object({
      activity: z.enum(["INITIAL_SCREENING", "FINAL_INTERVIEW", "CONTRACT_SIGNING"]),
      reason: safeProseSchema("Reason", 500).pipe(z.string().min(10, "Tell your recruiter why in at least 10 characters.")),
    }).strict(),
  }),
  respondInvitation: z.object({
    params: z.object({ id: boundedId }).strict(),
    body: talentPoolInvitationSchema.respondInvitation,
  }),
  complianceUpload: z.object({
    params: z.object({ requirementId: boundedId }).strict(),
    body: z.object({}).strict().optional(),
  }),
  complianceReuse: z.object({
    params: z.object({ requirementId: boundedId }).strict(),
    body: z.object({ documentId: boundedId }).strict(),
  }),
  complianceUploadParams: z.object({ params: z.object({ requirementId: boundedId }).strict() }),
};
