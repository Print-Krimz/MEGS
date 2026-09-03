import type { Request, Response } from "express";
import { ZodError } from "zod";
import { talentPoolInvitationSchema } from "../../schemas/talent-pool-invitation.schema.js";
import {
  sendTalentPoolJobInvitation,
  batchSendTalentPoolJobInvitations,
  listOutgoingInvitations,
  cancelTalentPoolInvitation,
  expirePendingInvitationsWorker,
} from "../../services/ta/talent-pool-invitation.service.js";
import { InvalidKnnRequestError } from "../../services/scoring/talent-pool-knn.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

const handle = (res: Response, error: unknown) => {
  if (error instanceof ZodError) {
    const firstMessage = error.issues[0]?.message || "Invalid invitation request";
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
  return sendError(res, error instanceof Error ? error.message : "Unable to process invitation request", 500);
};

export const sendInvitationHandler = async (req: Request, res: Response) => {
  try {
    const input = talentPoolInvitationSchema.sendInvitation.parse(req.body);
    const result = await sendTalentPoolJobInvitation({
      ...input,
      recruiterId: req.user!.id,
    });
    return sendSuccess(res, "Job invitation sent successfully", result, 201);
  } catch (error) {
    handle(res, error);
  }
};

export const batchSendInvitationsHandler = async (req: Request, res: Response) => {
  try {
    const input = talentPoolInvitationSchema.batchSendInvitations.parse(req.body);
    const result = await batchSendTalentPoolJobInvitations({
      ...input,
      recruiterId: req.user!.id,
    });
    return sendSuccess(res, `Batch invitations sent (${result.sentCount} succeeded, ${result.failedCount} failed)`, result, 201);
  } catch (error) {
    handle(res, error);
  }
};

export const listInvitationsHandler = async (req: Request, res: Response) => {
  try {
    const query = talentPoolInvitationSchema.listQuery.parse(req.query);
    const result = await listOutgoingInvitations(query);
    return sendSuccess(res, "Invitations retrieved", result);
  } catch (error) {
    handle(res, error);
  }
};

export const cancelInvitationHandler = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return sendError(res, "Invalid invitation ID", 400);
    }
    const result = await cancelTalentPoolInvitation(id, req.user!.id);
    return sendSuccess(res, "Invitation cancelled successfully", result);
  } catch (error) {
    handle(res, error);
  }
};

export const expireOverdueInvitationsHandler = async (_req: Request, res: Response) => {
  try {
    const result = await expirePendingInvitationsWorker();
    return sendSuccess(res, `Expired ${result.expiredCount} overdue invitations`, result);
  } catch (error) {
    handle(res, error);
  }
};
