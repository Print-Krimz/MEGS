import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  bulkAdvanceToContractSigning,
  bulkArchiveApplications,
  bulkCancelInvitations,
  bulkConfirmContractSigned,
  bulkConfirmDeploymentStart,
  bulkDismissCheckIns,
  bulkEndDeployments,
  bulkEndorseApplications,
  bulkRecordClientDecision,
  bulkRecordInterviews,
  bulkRejectApplications,
  bulkRestoreApplications,
  bulkScheduleInterviews,
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
    const { items, result, notes, autoAdvance } = req.body;
    respond(res, await bulkRecordInterviews(items, { result, notes, autoAdvance }, req.user!));
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

// POST /api/ta/bulk/deployments/end - End several active assignments with one date, reason and next step
export const bulkEndDeploymentsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, actualEnd, reason, disposition } = req.body;
    respond(res, await bulkEndDeployments(ids, { actualEnd, reason, disposition }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/interviews/schedule - Schedule interviews for many applications
export const bulkScheduleInterviewsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items, type, location } = req.body;
    respond(res, await bulkScheduleInterviews(items, { type, location }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/endorse - Send selected applications to client review
export const bulkEndorseApplicationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, clientId, notes } = req.body;
    respond(res, await bulkEndorseApplications(ids, { clientId, notes }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/client-decision - Record client approval or decline across applications
export const bulkClientDecisionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids, outcome, notes } = req.body;
    respond(res, await bulkRecordClientDecision(ids, { outcome, notes }, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/advance-contract-signing - Move compliant applications to Contract Signing
export const bulkAdvanceToContractSigningHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkAdvanceToContractSigning(req.body.ids, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};

// POST /api/ta/bulk/applications/confirm-contract-signed - Confirm contract signing for selected applications
export const bulkConfirmContractSignedHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    respond(res, await bulkConfirmContractSigned(req.body.ids, req.user!));
  } catch (error: any) {
    sendError(res, error.message, 500, error);
  }
};
