import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { logAudit } from '../../utils/audit.js';
import {
  updateToOnboarding,
  savePostHireDocument,
  executeHiring
} from '../../services/ta/ta.posthire.service.js';

// PATCH /api/ta/applications/:id/onboard - Move candidate to ONBOARDING state
export const startOnboarding = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const updated = await updateToOnboarding(applicationId, req.user!.id, req.body?.reason);
    sendSuccess(res, "Candidate moved to ONBOARDING", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// POST /api/ta/applications/:id/documents - Upload post-hire compliance documents (medical, NBI, contract)
export const uploadPostHireDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { label, notes } = req.body;
    if (!label) {
      sendError(res, "Label is required (e.g., 'Medical Certificate')", 400);
      return;
    }
    const document = await savePostHireDocument(applicationId, label, req.file, notes);
    sendSuccess(res, "Post-hire document uploaded successfully", document, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 :
                       error.message.includes("No file") ? 400 : 500;
    sendError(res, error.message, statusCode);
  }
};

// POST /api/ta/applications/:id/hire - Finalize hiring and generate employee Vault201 record
export const completeHiring = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const result = await executeHiring(applicationId, req.body, req.user!.id);
    
    logAudit(req.user!.id, "CANDIDATE_HIRED", "Application", applicationId, {
      vault201Id: result.vault201.id,
      employeeId: req.body.employeeId
    });

    sendSuccess(res, "Candidate successfully HIRED and Vault201 created", result, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 
                       error.message.includes("Cannot hire") || error.message.includes("already has") ? 400 : 500;
    sendError(res, "Failed to complete hiring process: " + error.message, statusCode);
  }
};
