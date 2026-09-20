import { Request, Response } from "express";
import { getActiveScoringConfiguration } from "../../services/scoring/scoring-configuration.service.js";
import { sendSuccess } from "../../utils/response.js";

/**
 * Serves global application configuration settings to the frontend.
 */
export const getGlobalConfig = async (_req: Request, res: Response) => {
  try {
    const config = await getActiveScoringConfiguration();
    const threshold = config?.matchThreshold ?? 60;
    sendSuccess(res, "Global configuration retrieved", {
      MATCH_THRESHOLD: threshold,
      matchThreshold: threshold,
    });
  } catch (error) {
    sendSuccess(res, "Global configuration retrieved", {
      MATCH_THRESHOLD: 60,
      matchThreshold: 60,
    });
  }
};
