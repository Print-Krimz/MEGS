import type { Request, Response } from "express";
import { offerReplySchema } from "../../schemas/offer-reply.schema.js";
import { getOfferByToken, respondViaOfferLink } from "../../services/ta/talent-pool-invitation.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

// Every failure is a 404: a 401 would send the browser to /login, and detail would help token guessing.
const notFound = (res: Response) => sendError(res, "This link no longer works.", 404);

const noStore = (res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
};

// GET /api/public/offers/:id?token=
export const getPublicOfferHandler = async (req: Request, res: Response) => {
  noStore(res);
  try {
    const params = offerReplySchema.publicParams.safeParse(req.params);
    const query = offerReplySchema.publicQuery.safeParse({ token: req.query.token });
    if (!params.success || !query.success) return notFound(res);
    const offer = await getOfferByToken(params.data.id, query.data.token);
    return sendSuccess(res, "Offer retrieved", offer);
  } catch {
    return notFound(res);
  }
};

// POST /api/public/offers/:id/respond  { token, decision, declineReason? }
export const respondPublicOfferHandler = async (req: Request, res: Response) => {
  noStore(res);
  try {
    const params = offerReplySchema.publicParams.safeParse(req.params);
    const body = offerReplySchema.publicRespond.safeParse(req.body);
    if (!params.success || !body.success) return notFound(res);
    const result = await respondViaOfferLink(params.data.id, body.data.token, body.data.decision, body.data.declineReason);
    return sendSuccess(res, "Reply recorded", result);
  } catch {
    return notFound(res);
  }
};
