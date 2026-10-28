import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { createRescheduleRequest, SchedulingError } from "../../services/scheduling/reschedule.service.js";

// POST /api/applicant/applications/:id/reschedule-requests
export const createRescheduleRequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { activity, reason } = req.body;
    const request = await createRescheduleRequest(applicationId, req.user!.id, activity, reason);
    sendSuccess(res, "Reschedule request sent", request, 201);
  } catch (error: any) {
    sendError(res, error.message, error instanceof SchedulingError ? error.status : 400);
  }
};
