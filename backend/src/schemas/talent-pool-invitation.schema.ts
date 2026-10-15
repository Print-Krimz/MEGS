import { z } from "zod";

const boundedId = z.union([z.number().finite().int().min(1).max(2_147_483_647), z.string().regex(/^[0-9]{1,10}$/).transform(Number).refine((value) => value >= 1 && value <= 2_147_483_647)]);
const pageNumber = z.union([z.number().finite().int().min(1).max(2_147_483_647), z.string().regex(/^[0-9]{1,10}$/).transform(Number).refine((value) => value >= 1 && value <= 2_147_483_647)]);

export const talentPoolInvitationSchema = {
  sendInvitation: z.object({
    applicantProfileId: boundedId,
    targetJobId: boundedId,
    message: z.string().trim().max(1000, "Message must not exceed 1000 characters").optional(),
    expiresInDays: z.union([z.number().finite().int().min(1).max(30), z.string().regex(/^\d{1,2}$/).transform(Number).refine((value) => value >= 1 && value <= 30)]).default(7),
  }).strict(),

  batchSendInvitations: z.object({
    applicantProfileIds: z.array(boundedId).min(1, "At least one candidate is required").max(100).refine((ids) => new Set(ids).size === ids.length, "Candidate list must not contain duplicates"),
    targetJobId: boundedId,
    message: z.string().trim().max(1000).optional(),
    expiresInDays: z.union([z.number().finite().int().min(1).max(30), z.string().regex(/^\d{1,2}$/).transform(Number).refine((value) => value >= 1 && value <= 30)]).default(7),
  }).strict(),

  respondInvitation: z.object({
    decision: z.enum(["ACCEPT", "DECLINE"], { message: "decision must be ACCEPT or DECLINE" }),
    declineReason: z.enum([
      "SALARY_MISMATCH",
      "UNAVAILABLE_EMPLOYED",
      "LOCATION_COMMUTE",
      "NOT_INTERESTED",
      "OTHER",
    ]).optional(),
    notes: z.string().max(500).optional(),
  }).strict(),

  listQuery: z.object({
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "ALL"]).default("ALL"),
    jobPostingId: boundedId.optional(),
    page: pageNumber.default(1),
    limit: z.union([z.number().finite().int().min(1).max(50), z.string().regex(/^[0-9]{1,2}$/).transform(Number).refine((value) => value >= 1 && value <= 50)]).default(10),
  }).strict(),
};

export const talentPoolInvitationRouteSchema = {
  send: z.object({ body: talentPoolInvitationSchema.sendInvitation }),
  batchSend: z.object({ body: talentPoolInvitationSchema.batchSendInvitations }),
  list: z.object({ query: talentPoolInvitationSchema.listQuery }),
  respond: z.object({
    params: z.object({ id: boundedId }).strict(),
    body: talentPoolInvitationSchema.respondInvitation,
  }),
  cancel: z.object({ params: z.object({ id: boundedId }).strict() }),
};
