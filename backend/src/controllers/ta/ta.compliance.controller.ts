import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  createComplianceRequirement,
  listComplianceRequirements,
  submitDocumentForRequirement,
  reviewComplianceRequirement,
} from "../../services/ta/ta.compliance.service.js";

export const createRequirementHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { documentLabel, isRequired, deadline } = req.body;

    if (isNaN(applicationId) || !documentLabel) {
      sendError(res, "applicationId and documentLabel are required", 400);
      return;
    }

    const requirement = await createComplianceRequirement(applicationId, documentLabel, isRequired, deadline);
    sendSuccess(res, "Compliance requirement created", requirement, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const listRequirementsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }

    const list = await listComplianceRequirements(applicationId);
    sendSuccess(res, "Compliance requirements retrieved", list);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const submitDocumentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    const { documentId } = req.body;

    if (isNaN(requirementId) || !documentId) {
      sendError(res, "requirementId and documentId are required", 400);
      return;
    }

    const updated = await submitDocumentForRequirement(requirementId, parseInt(documentId, 10));
    sendSuccess(res, "Document submitted for compliance requirement", updated);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const reviewRequirementHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    const { reviewStatus, reviewNotes } = req.body;

    if (isNaN(requirementId) || !["APPROVED", "REJECTED", "PENDING"].includes(reviewStatus)) {
      sendError(res, "Valid reviewStatus (APPROVED, REJECTED, PENDING) is required", 400);
      return;
    }

    const updated = await reviewComplianceRequirement(
      requirementId,
      req.user!.id,
      reviewStatus,
      reviewNotes
    );
    sendSuccess(res, "Compliance review updated", updated);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};
