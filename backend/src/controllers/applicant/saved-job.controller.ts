import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  saveJobService,
  unsaveJobService,
  listSavedJobsService,
  getSavedJobIdsService,
} from "../../services/applicant/saved-job.service.js";

export const saveJobHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const jobId = Number(req.params.id || req.params.jobId);

    if (isNaN(jobId)) {
      sendError(res, "Valid job ID is required", 400);
      return;
    }

    const saved = await saveJobService(userId, jobId);
    sendSuccess(res, "Job saved successfully", saved, 201);
  } catch (error: any) {
    sendError(res, error.message || "Failed to save job", 400);
  }
};

export const unsaveJobHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const jobId = Number(req.params.id || req.params.jobId);

    if (isNaN(jobId)) {
      sendError(res, "Valid job ID is required", 400);
      return;
    }

    const result = await unsaveJobService(userId, jobId);
    sendSuccess(res, "Job removed from saved jobs", result, 200);
  } catch (error: any) {
    sendError(res, error.message || "Failed to unsave job", 400);
  }
};

export const listSavedJobsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const jobs = await listSavedJobsService(userId);
    sendSuccess(res, "Saved jobs retrieved", jobs, 200);
  } catch (error: any) {
    sendError(res, error.message || "Failed to list saved jobs", 500);
  }
};

export const getSavedJobIdsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const ids = await getSavedJobIdsService(userId);
    sendSuccess(res, "Saved job IDs retrieved", ids, 200);
  } catch (error: any) {
    sendError(res, error.message || "Failed to get saved job IDs", 500);
  }
};
