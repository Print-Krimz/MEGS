import { z } from "zod";

const invitationId = z.union([
  z.number().finite().int().min(1).max(2_147_483_647),
  z.string().regex(/^[0-9]{1,10}$/).transform(Number).refine((value) => value >= 1 && value <= 2_147_483_647),
]);

const declineReason = z.enum(["SALARY_MISMATCH", "UNAVAILABLE_EMPLOYED", "LOCATION_COMMUTE", "NOT_INTERESTED", "OTHER"]);
const offerToken = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const offerReplySchema = {
  assistedResponse: z.object({
    decision: z.enum(["ACCEPT", "DECLINE"], { message: "decision must be ACCEPT or DECLINE" }),
    channel: z.enum(["ASSISTED_PHONE", "IN_PERSON"], { message: "channel must be ASSISTED_PHONE or IN_PERSON" }),
    declineReason: declineReason.optional(),
    notes: z.string().trim().max(500).optional(),
  }).strict(),
  publicRespond: z.object({
    token: offerToken,
    decision: z.enum(["ACCEPT", "DECLINE"]),
    declineReason: declineReason.optional(),
  }).strict(),
  publicQuery: z.object({ token: offerToken }),
  publicParams: z.object({ id: invitationId }),
};

export const offerReplyRouteSchema = {
  assistedResponse: z.object({
    params: z.object({ id: invitationId }).strict(),
    body: offerReplySchema.assistedResponse,
  }),
  smsLink: z.object({ params: z.object({ id: invitationId }).strict() }),
};
