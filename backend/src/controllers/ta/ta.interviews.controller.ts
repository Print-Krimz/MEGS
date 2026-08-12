import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  fetchInterviews,
  scheduleNewInterview,
  updateInterviewResult,
  getInterviewComplianceReport
} from '../../services/ta/ta.interviews.service.js';

// GET /api/ta/applications/:id/interviews - List scheduled/completed interviews
export const listInterviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const interviews = await fetchInterviews(applicationId);
    sendSuccess(res, "Interviews retrieved", interviews);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/ta/applications/:id/interviews - Schedule interview with 7-day SLA target
export const scheduleInterview = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { type, scheduledAt, notes } = req.body;
    const interview = await scheduleNewInterview(applicationId, type, scheduledAt, notes);
    sendSuccess(res, "Interview scheduled", interview);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/applications/:id/interviews/:interviewId/status - Record result (auto-archives NO_SHOW)
export const updateInterviewStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    const interviewId = parseInt(req.params.interviewId as string);
    if (isNaN(applicationId) || isNaN(interviewId)) {
      sendError(res, "Invalid IDs", 400);
      return;
    }
    const { result, conductedAt, notes } = req.body;
    const { updatedInterview, applicationUpdateMessage } = await updateInterviewResult(applicationId, interviewId, result, conductedAt, notes);
    sendSuccess(res, `Interview updated to ${result}.${applicationUpdateMessage}`, updatedInterview);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// GET /api/ta/compliance/interviews - Audit report for candidate interview stage SLA duration
export const checkInterviewCompliance = async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await getInterviewComplianceReport();
    sendSuccess(res, "Interview compliance report generated", report);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
