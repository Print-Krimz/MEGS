import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  bulkArchiveApplications,
  bulkCancelInvitations,
  bulkConfirmDeploymentStart,
  bulkDismissCheckIns,
  bulkEndDeployments,
  bulkRecordDeploymentCheckIns,
  bulkRecordInterviews,
  bulkRejectApplications,
  bulkRestoreApplications,
  type BulkSummary,
} from "../../services/ta/ta.bulk.service.js";

const respond = (res: Response, summary: BulkSummary) =>
  sendSuccess(res, `${summary.succeeded} done, ${summary.failed} failed`, summary);

// POST /api/ta/bulk/applications/reject - Reject many applications with one reason and disposition
export const bulkRejectApplicationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, reasonCode, disposition, notes } = req.body;
    respond(res, await bulkRejectApplications(ids, { reasonCode, disposition, notes }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/archive
export const bulkArchiveApplicationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkArchiveApplications(req.body.ids, req.body.reason, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/restore
export const bulkRestoreApplicationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkRestoreApplications(req.body.ids, req.body.reason, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/interviews/result - Record Passed or No show for many interviews
export const bulkRecordInterviewsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, result, notes } = req.body;
    respond(res, await bulkRecordInterviews(items, { result, notes }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/check-ins/dismiss - Dismiss many waiting check-ins with one reason
export const bulkDismissCheckInsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkDismissCheckIns(req.body.ids, req.body.reason, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/invitations/cancel - Cancel many pending invitations the TA sent
export const bulkCancelInvitationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkCancelInvitations(req.body.ids, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/deployments/confirm-start - Confirm site start for many ready deployments
export const bulkConfirmDeploymentStartHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkConfirmDeploymentStart(req.body.items, req.body.notes, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/deployments/check-in - Record a check-in for many active deployments
export const bulkRecordDeploymentCheckInsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, nextReviewAt, notes } = req.body;
    respond(res, await bulkRecordDeploymentCheckIns(ids, { nextReviewAt, notes }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/deployments/end - End several active assignments with one date, reason and next step
export const bulkEndDeploymentsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, actualEnd, reason, disposition } = req.body;
    respond(res, await bulkEndDeployments(ids, { actualEnd, reason, disposition }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};
