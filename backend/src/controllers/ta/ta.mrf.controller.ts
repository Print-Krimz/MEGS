import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  listMRFs,
  createMRF,
  getMRFDetails,
  updateMRF,
  linkJobToMRF,
} from "../../services/ta/ta.mrf.service.js";

export const listMRFsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const status = req.query.status as string | undefined;
    const mrfs = await listMRFs(clientId, status);
    sendSuccess(res, "Manpower Requests retrieved successfully", mrfs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const createMRFHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, title } = req.body;
    if (!clientId || !title) {
      sendError(res, "clientId and title are required", 400);
      return;
    }

    const mrf = await createMRF(req.user!.id, req.body);
    sendSuccess(res, "Manpower Request created successfully", mrf, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const getMRFDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid MRF ID", 400);
      return;
    }

    const mrf = await getMRFDetails(id);
    sendSuccess(res, "Manpower Request details retrieved successfully", mrf);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

export const updateMRFHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid MRF ID", 400);
      return;
    }

    const updated = await updateMRF(id, req.body);
    sendSuccess(res, "Manpower Request updated successfully", updated);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

export const linkJobToMRFHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const mrfId = parseInt(req.params.id as string, 10);
    const { jobPostingId } = req.body;
    if (isNaN(mrfId) || !jobPostingId) {
      sendError(res, "Valid mrfId and jobPostingId are required", 400);
      return;
    }

    const updatedJob = await linkJobToMRF(mrfId, parseInt(jobPostingId, 10));
    sendSuccess(res, "Job posting linked to MRF successfully", updatedJob);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};
