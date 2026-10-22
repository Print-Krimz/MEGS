import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import { getPublicTracking } from "../../services/ta/walk-in.service.js";

// GET /api/public/track/:code?token= - no login. Every failure is a 404 so a bad link never reveals which part was wrong.
export const getPublicTrackingHandler = async (req: Request, res: Response): Promise<void> => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  try {
    const code = String(req.params.code ?? "");
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const tracking = await getPublicTracking(code, token);
    if (!tracking) {
      sendError(res, "This link no longer works", 404);
      return;
    }
    sendSuccess(res, "Tracking retrieved", tracking);
  } catch {
    sendError(res, "This link no longer works", 404);
  }
};
