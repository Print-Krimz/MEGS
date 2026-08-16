import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  listTAApplications,
  getTAApplication,
  updateTAApplicationStatus,
  archiveTAApplication,
  restoreTAApplication,
  getRecruiterDecisionsService
} from '../../services/ta/ta.applications.service.js';

// GET /api/ta/applications - List and filter applications across postings
export const listApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, jobPostingId, jobId, search, isArchived, page, limit } = req.query;
    const result = await listTAApplications({
      status: status as string,
      jobPostingId: (jobPostingId || jobId) as string,
      search: search as string,
      isArchived: isArchived !== undefined ? isArchived === "true" : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    sendSuccess(res, "Applications retrieved", result);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/ta/applications/:id - Comprehensive candidate profile, scores, and interviews
export const getApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const formatted = await getTAApplication(id);
    sendSuccess(res, "Application retrieved", formatted);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// PATCH /api/ta/applications/:id/status - Move candidate through pipeline stages
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { status, reason } = req.body;
    if (!status) {
      sendError(res, "status is required", 400);
      return;
    }
    const updated = await updateTAApplicationStatus(id, status, req.user!.id, reason);
    sendSuccess(res, `Application moved to ${updated.status}`, updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

export const getRecruiterDecisionsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const decisions = await getRecruiterDecisionsService(id);
    sendSuccess(res, "Recruiter decisions retrieved", decisions);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// PATCH /api/ta/applications/:id/archive - Soft-archive candidate record
export const archiveApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const updated = await archiveTAApplication(id);
    sendSuccess(res, "Application archived", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/applications/:id/restore - Restore soft-archived candidate to SUBMITTED
export const restoreApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const updated = await restoreTAApplication(id);
    sendSuccess(res, "Application restored to pipeline", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};
