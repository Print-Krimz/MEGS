import type { Request, Response } from "express";
import { InvalidKnnRequestError } from "../../services/scoring/talent-pool-knn.service.js";
import {
  InvitationActionError,
  recordAssistedResponse,
  sendOfferSmsLink,
} from "../../services/ta/talent-pool-invitation.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

const idOf = (req: Request): number => Number(req.params.id);

const fail = (res: Response, error: unknown) => {
  if (error instanceof InvitationActionError) return sendError(res, error.message, error.status);
  if (error instanceof InvalidKnnRequestError) return sendError(res, error.message, 409);
  return sendError(res, error instanceof Error ? error.message : "Unable to process the offer reply", 500, error);
};

// POST /api/ta/talent-pool/invitations/:id/assisted-response
export const recordAssistedResponseHandler = async (req: Request, res: Response) => {
  try {
    const { decision, channel, declineReason, notes } = req.body;
    const result = await recordAssistedResponse({
      invitationId: idOf(req),
      taId: req.user!.id,
      decision,
      channel,
      declineReason,
      notes,
    });
    return sendSuccess(res, "Reply recorded", result);
  } catch (error) {
    return fail(res, error);
  }
};

// POST /api/ta/talent-pool/invitations/:id/sms-link
export const sendOfferSmsLinkHandler = async (req: Request, res: Response) => {
  try {
    const result = await sendOfferSmsLink({ invitationId: idOf(req), taId: req.user!.id });
    return sendSuccess(res, "Offer link sent", result);
  } catch (error) {
    return fail(res, error);
  }
};
