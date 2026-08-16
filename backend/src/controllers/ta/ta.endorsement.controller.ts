import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  recordClientEndorsement,
  listClientEndorsements,
  updateClientEndorsement,
} from "../../services/ta/ta.endorsement.service.js";


export const recordEndorsementHandler = async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    if (isNaN(applicationId)) return sendError(res, "Invalid application ID", 400);

    const { clientId, outcome, notes } = req.body;
    const endorsement = await recordClientEndorsement(
      applicationId,
      clientId,
      outcome,
      req.user?.id,
      notes
    );
    return sendSuccess(res, "Client endorsement recorded successfully", endorsement, 201);
  } catch (error: any) {
    return sendError(res, error.message, 400);
  }
};

export const listEndorsementsHandler = async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    if (isNaN(applicationId)) return sendError(res, "Invalid application ID", 400);

    const endorsements = await listClientEndorsements(applicationId);
    return sendSuccess(res, "Client endorsements retrieved successfully", endorsements);
  } catch (error: any) {
    return sendError(res, error.message, 400);
  }
};

export const updateEndorsementHandler = async (req: Request, res: Response) => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const endorsementId = parseInt(req.params.endorsementId as string, 10);
    if (isNaN(applicationId) || isNaN(endorsementId)) {
      return sendError(res, "Invalid application ID or endorsement ID", 400);
    }

    const { outcome, notes } = req.body;
    const updated = await updateClientEndorsement(
      applicationId,
      endorsementId,
      outcome,
      req.user?.id,
      notes
    );
    return sendSuccess(res, "Client endorsement updated successfully", updated);
  } catch (error: any) {
    return sendError(res, error.message, 400);
  }
};
