import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { correctInterviewResult } from '../../services/ta/ta.interviews.service.js';

// PATCH /api/admin/interviews/:interviewId/result - Admin-only correction of a finalized result
export const correctInterviewResultHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const interviewId = parseInt(req.params.interviewId as string, 10);
    if (isNaN(interviewId)) {
      sendError(res, "Invalid interview ID", 400);
      return;
    }
    const { result, reason, notes } = req.body;
    const outcome = await correctInterviewResult(interviewId, result, reason, req.user!.id, notes);
    sendSuccess(res, "Interview result corrected", outcome);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};
