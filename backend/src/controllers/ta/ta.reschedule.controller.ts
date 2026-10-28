import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { scheduleContractSigning } from "../../services/ta/ta.applications.service.js";
import {
  approveRescheduleRequest,
  rejectRescheduleRequest,
  SchedulingError,
} from "../../services/scheduling/reschedule.service.js";

const fail = (res: Response, error: any): void => {
  const status = error instanceof SchedulingError ? error.status : /not found/i.test(error.message) ? 404 : 400;
  sendError(res, error.message, status);
};

// POST /api/ta/applications/:id/contract-signing/schedule
export const scheduleContractSigningHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { scheduledAt, location } = req.body;
    const result = await scheduleContractSigning(applicationId, scheduledAt, location, req.user?.id);
    sendSuccess(res, "Contract signing scheduled", result);
  } catch (error: any) {
    fail(res, error);
  }
};

// POST /api/ta/applications/:id/reschedule-requests/:requestId/approve
export const approveRescheduleRequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await approveRescheduleRequest(
      parseInt(req.params.id as string, 10),
      parseInt(req.params.requestId as string, 10),
      req.user!.id,
      req.body
    );
    sendSuccess(res, "Reschedule approved", request);
  } catch (error: any) {
    fail(res, error);
  }
};

// POST /api/ta/applications/:id/reschedule-requests/:requestId/reject
export const rejectRescheduleRequestHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const request = await rejectRescheduleRequest(
      parseInt(req.params.id as string, 10),
      parseInt(req.params.requestId as string, 10),
      req.user!.id,
      req.body?.decisionNote
    );
    sendSuccess(res, "Reschedule declined", request);
  } catch (error: any) {
    fail(res, error);
  }
};
