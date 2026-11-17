import type { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { verifyUnsubscribeToken } from "../../utils/job-alert-token.js";
import { turnOffJobAlertEmail } from "../../services/applicant/job-alert.service.js";

// One-click unsubscribe (RFC 8058). Mail apps POST here with the token from the email's link in the query;
// the body is ignored. The token can only turn job emails off.
export const unsubscribeJobAlertsHandler = async (req: Request, res: Response): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token.slice(0, 200) : "";
  let userId: string | null = null;
  try {
    userId = verifyUnsubscribeToken(token);
  } catch (error) {
    return void sendError(res, "Unsubscribe is unavailable right now.", 500, error);
  }
  if (!userId) return void sendError(res, "This unsubscribe link is not valid.", 400);
  try {
    await turnOffJobAlertEmail(userId);
    sendSuccess(res, "You will no longer get job alert emails.", { unsubscribed: true });
  } catch (error) {
    sendError(res, "Could not update your job alerts. Please try again.", 500, error);
  }
};
