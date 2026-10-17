import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { queueApplicationAnalysis } from '../../services/ta/ta.ai.service.js';
import { getAnalysisProgress } from '../../workers/resume.worker.js';

// POST /api/ta/applications/:id/analyze - Enqueues background Gemini AI resume analysis
export const analyzeApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const result = await queueApplicationAnalysis(id);
    sendSuccess(res, "Resume analysis queued. Results will be available shortly.", result);
  } catch (error: any) {
    // Archived and backed-out applications conflict with their current state (409); the
    // message is on the public allow-list so TA sees the real reason.
    const statusCode = error.status === 429 ? 429
      : error.message.includes("not found") ? 404
      : /archived application|backed out/.test(error.message) ? 409
      : 400;
    if (statusCode === 429) res.setHeader("Retry-After", "5");
    sendError(res, error.message, statusCode);
  }
};

// GET /api/ta/applications/:id/analyze/status - Current step of the latest resume analysis run
export const getAnalysisStatus = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) {
    sendError(res, "Invalid application ID", 400);
    return;
  }
  sendSuccess(res, "Analysis status", getAnalysisProgress(id) ?? { phase: "IDLE" });
};
