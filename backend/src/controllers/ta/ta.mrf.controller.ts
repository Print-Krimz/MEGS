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
      sendError(res, "Valid mrfId in URL and jobPostingId in body are required", 400);
      return;
    }

    const updatedJob = await linkJobToMRF(mrfId, jobPostingId);
    sendSuccess(res, "Job successfully linked to MRF", updatedJob);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const addMRFComplianceTemplateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const mrfId = parseInt(req.params.id as string, 10);
    if (isNaN(mrfId)) {
      sendError(res, "Invalid MRF ID", 400);
      return;
    }

    const { documentLabel, isRequired = true } = req.body;
    if (!documentLabel) {
      sendError(res, "documentLabel is required", 400);
      return;
    }

    const { addMRFComplianceTemplate } = await import("../../services/ta/ta.mrf.service.js");
    const template = await addMRFComplianceTemplate(mrfId, documentLabel, isRequired);
    sendSuccess(res, "Compliance template added to MRF", template, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const listMRFComplianceTemplatesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const mrfId = parseInt(req.params.id as string, 10);
    if (isNaN(mrfId)) {
      sendError(res, "Invalid MRF ID", 400);
      return;
    }

    const { listMRFComplianceTemplates } = await import("../../services/ta/ta.mrf.service.js");
    const templates = await listMRFComplianceTemplates(mrfId);
    sendSuccess(res, "MRF compliance templates retrieved", templates);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const removeMRFComplianceTemplateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const templateId = parseInt(req.params.templateId as string, 10);
    if (isNaN(templateId)) {
      sendError(res, "Invalid template ID", 400);
      return;
    }

    const { removeMRFComplianceTemplate } = await import("../../services/ta/ta.mrf.service.js");
    await removeMRFComplianceTemplate(templateId);
    sendSuccess(res, "Compliance template removed from MRF", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};
