import { Request, Response } from "express";
import { getActiveScoringConfiguration } from "../../services/scoring/scoring-configuration.service.js";
import { getSecurityControls } from "../../security/security-controls.js";
import { isDailyConfigured } from "../../services/scheduling/daily-meeting.service.js";
import { sendSuccess } from "../../utils/response.js";

/**
 * Serves global application configuration settings to the frontend.
 */
export const getGlobalConfig = async (_req: Request, res: Response) => {
  const onlineMeetingAutoEnabled = isDailyConfigured();
  try {
    const config = await getActiveScoringConfiguration();
    const threshold = config?.matchThreshold ?? 60;
    sendSuccess(res, "Global configuration retrieved", {
      MATCH_THRESHOLD: threshold,
      matchThreshold: threshold,
      onlineMeetingAutoEnabled,
    });
  } catch (error) {
    sendSuccess(res, "Global configuration retrieved", {
      MATCH_THRESHOLD: 60,
      matchThreshold: 60,
      onlineMeetingAutoEnabled,
    });
  }
};

// Only public booleans needed by pending demo forms; no environment secrets.
export const getSecurityStatus = (_req: Request, res: Response) =>
  sendSuccess(res, "Security status retrieved", getSecurityControls());
