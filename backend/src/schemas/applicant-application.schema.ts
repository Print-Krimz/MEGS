import { z } from "zod";
import { boundedId, boundedText, boundedPageSize, finiteNumber, FIELD_LIMITS } from "./field-limits.js";
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
      page: finiteNumber({ min: 1, max: FIELD_LIMITS.integerId, integer: true }).optional(),
      limit: boundedPageSize.optional(),
    }).strict(),
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
