import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import { getTADashboardCounts } from "../../services/ta/ta.dashboard.service.js";

export const getTADashboardCountsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const counts = await getTADashboardCounts(req.user);
    sendSuccess(res, "TA dashboard counts retrieved", counts);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
