import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { queueApplicationAnalysis } from '../../services/ta/ta.ai.service.js';

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
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};
