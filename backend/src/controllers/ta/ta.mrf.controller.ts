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
    const priority = req.query.priority as string | undefined;
    const sortBy = (req.query.sortBy as any) || "priority";
    const mrfs = await listMRFs(clientId, status, priority, sortBy);
    sendSuccess(res, "Manpower Requests retrieved successfully", mrfs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const validateMRFBoundaries = (body: any): string | null => {
  if (body.headcount !== undefined) {
    const hc = body.headcount;
    if (
      hc === null ||
      hc === "" ||
      typeof hc === "boolean" ||
      typeof hc === "object"
    ) {
      return "Headcount must be an integer between 1 and 1,000";
    }
    const parsed = Number(hc);
    if (isNaN(parsed) || !Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
      return "Headcount must be an integer between 1 and 1,000";
    }
  }

  const hasMin = body.salaryRangeMin !== undefined && body.salaryRangeMin !== null && body.salaryRangeMin !== "";
  const hasMax = body.salaryRangeMax !== undefined && body.salaryRangeMax !== null && body.salaryRangeMax !== "";

  let minVal: number | undefined;
  let maxVal: number | undefined;

  if (hasMin) {
    if (typeof body.salaryRangeMin === "boolean" || typeof body.salaryRangeMin === "object") {
      return "Minimum monthly salary must be between 0 and 1,000,000 PHP";
    }
    minVal = Number(body.salaryRangeMin);
    if (isNaN(minVal) || minVal < 0 || minVal > 1000000) {
      return "Minimum monthly salary must be between 0 and 1,000,000 PHP";
    }
  }

  if (hasMax) {
    if (typeof body.salaryRangeMax === "boolean" || typeof body.salaryRangeMax === "object") {
      return "Maximum monthly salary must be between 0 and 1,000,000 PHP";
    }
    maxVal = Number(body.salaryRangeMax);
    if (isNaN(maxVal) || maxVal < 0 || maxVal > 1000000) {
      return "Maximum monthly salary must be between 0 and 1,000,000 PHP";
    }
  }

  if (hasMin && hasMax && minVal !== undefined && maxVal !== undefined) {
    if (minVal > maxVal) {
      return "Minimum monthly salary cannot exceed maximum monthly salary";
    }
  }

  return null;
};

export const createMRFHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, title } = req.body;
    if (!clientId || !title) {
      sendError(res, "clientId and title are required", 400);
      return;
    }

    const validationError = validateMRFBoundaries(req.body);
    if (validationError) {
      sendError(res, validationError, 400);
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

    const validationError = validateMRFBoundaries(req.body);
    if (validationError) {
      sendError(res, validationError, 400);
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
    const rawJobId = req.body.jobPostingId ?? req.body.jobId;
    const jobPostingId = rawJobId ? parseInt(String(rawJobId), 10) : undefined;
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
