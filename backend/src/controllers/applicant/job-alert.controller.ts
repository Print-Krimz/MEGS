import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { getJobAlertSettings, updateJobAlertSettings, JobAlertError } from "../../services/applicant/job-alert.service.js";

export const getJobAlertsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Job alert settings fetched", await getJobAlertSettings(req.user!.id));
  } catch (error) {
    if (error instanceof JobAlertError) return void sendError(res, error.message, 400);
    sendError(res, "Failed to load job alert settings", 500, error);
  }
};

export const updateJobAlertsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Job alert settings saved", await updateJobAlertSettings(req.user!.id, req.body));
  } catch (error) {
    if (error instanceof JobAlertError) return void sendError(res, error.message, 400);
    sendError(res, "Failed to save job alert settings", 500, error);
  }
};
