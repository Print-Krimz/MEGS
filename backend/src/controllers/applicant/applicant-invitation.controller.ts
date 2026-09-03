import type { Request, Response } from "express";
import { ZodError } from "zod";
import { talentPoolInvitationSchema } from "../../schemas/talent-pool-invitation.schema.js";
import {
  getMyJobInvitations,
  respondToJobInvitation,
} from "../../services/ta/talent-pool-invitation.service.js";
import { InvalidKnnRequestError } from "../../services/scoring/talent-pool-knn.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

const handle = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    const firstMessage = error.issues[0]?.message || "Invalid invitation response";
    return res.status(422).json({
      success: false,
      message: firstMessage,
      code: "INVALID_REQUEST",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: "INVALID_VALUE",
        message: issue.message,
      })),
    });
  }
  if (error instanceof InvalidKnnRequestError) {
    return res.status(422).json({ success: false, message: error.message, code: error.code });
  }
  return sendError(res, error instanceof Error ? error.message : "Unable to process invitation response", 500);
};

export const getMyInvitationsHandler = async (req: Request, res: Response) => {
  try {
    const result = await getMyJobInvitations(req.user!.id);
    return sendSuccess(res, "Job invitations retrieved", result);
  } catch (error) {
    handle(res, error);
  }
};

export const respondToInvitationHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return sendError(res, "Invalid invitation ID", 400);
    }
    const input = talentPoolInvitationSchema.respondInvitation.parse(req.body);
    const result = await respondToJobInvitation({
      userId: req.user!.id,
      invitationId: id,
      ...input,
    });
    return sendSuccess(res, result.message, result);
  } catch (error) {
    handle(res, error);
  }
};
