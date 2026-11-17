import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  dismissRecommendation,
  recommendJobsForApplicant,
  undoDismissRecommendation,
} from "../../services/applicant/job-recommendation.service.js";

export const getRecommendationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
    const { items, coldStart } = await recommendJobsForApplicant(req.user!.id, { limit });
    // Applicants see the reasons, never the internal score.
    sendSuccess(res, "Recommended jobs fetched", {
      items: items.map(({ job, reasons }) => ({ ...job, reasons })),
      coldStart,
    });
  } catch (error) {
    sendError(res, "Failed to fetch recommended jobs", 500, error);
  }
};

export const dismissRecommendationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Recommendation hidden", await dismissRecommendation(req.user!.id, Number(req.params.id)));
  } catch (error) {
    // Foreign key failure: the job does not exist.
    if ((error as { code?: string } | null)?.code === "P2003") return void sendError(res, "Job not found", 404);
    sendError(res, "Failed to hide this recommendation", 500, error);
  }
};

export const undoDismissRecommendationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Recommendation restored", await undoDismissRecommendation(req.user!.id, Number(req.params.id)));
  } catch (error) {
    sendError(res, "Failed to restore this recommendation", 500, error);
  }
};
