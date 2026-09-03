import { z } from "zod";

export const talentPoolInvitationSchema = {
  sendInvitation: z.object({
    applicantProfileId: z.coerce.number().int().positive("applicantProfileId must be a positive integer"),
    targetJobId: z.coerce.number().int().positive("targetJobId must be a positive integer"),
    message: z.string().max(1000, "Message must not exceed 1000 characters").optional(),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  }),

  batchSendInvitations: z.object({
    applicantProfileIds: z.array(z.coerce.number().int().positive()).min(1, "At least one candidate is required"),
    targetJobId: z.coerce.number().int().positive("targetJobId must be a positive integer"),
    message: z.string().max(1000).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
  }),

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
  }),

  listQuery: z.object({
    status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "ALL"]).default("ALL"),
    jobPostingId: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
};
