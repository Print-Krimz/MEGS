import { Request, Response } from "express";
import { uploadComplianceDocumentForApplicant } from "../../services/applicant/application.service.js";
import { bulkUploadComplianceDocuments, BulkUploadRequestError } from "../../services/ta/ta.compliance-bulk.service.js";
import { requestComplianceDocumentUpdate } from "../../services/ta/ta.compliance.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  createComplianceRequirement,
  listComplianceRequirements,
  submitDocumentForRequirement,
  reviewComplianceRequirement,
  updateComplianceRequirementDeadline,
  deleteComplianceRequirement,
  getScopedComplianceApplications,
  ComplianceScope,
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
    const { reviewStatus, reviewNotes, expiresAt, issuedAt, validityStatus, toFollowExpectedAt } = req.body;

    const allowedStatuses = ["APPROVED", "REJECTED", "PENDING", "EXPIRED", "TO_FOLLOW", "SUBMITTED"];
    if (isNaN(requirementId) || !allowedStatuses.includes(reviewStatus)) {
      sendError(res, `Valid reviewStatus (${allowedStatuses.join(", ")}) is required`, 400);
      return;
    }

    const updated = await reviewComplianceRequirement(
      requirementId,
      req.user!.id,
      reviewStatus,
      reviewNotes,
      expiresAt,
      toFollowExpectedAt,
      issuedAt,
      validityStatus
    );
    sendSuccess(res, "Compliance review updated", updated);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const requestDocumentUpdateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await requestComplianceDocumentUpdate(Number(req.params.requirementId), req.user!.id, req.body.reason, req.body.deadline);
    sendSuccess(res, "Updated document requested", result);
  } catch (error: any) { sendError(res, error.message, error.message.includes("not found") ? 404 : 400); }
};

export const uploadComplianceDocumentForApplicantHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, "Attach the document photo or PDF", 400);
      return;
    }
    const updated = await uploadComplianceDocumentForApplicant({
      actor: { id: req.user!.id, role: req.user!.role },
      requirementId: Number(req.params.requirementId),
      file: req.file,
    });
    sendSuccess(res, "Document uploaded for the applicant", updated);
  } catch (error: any) {
    sendError(res, error.message, error.message.includes("not found") ? 404 : 400);
  }
};

export const bulkUploadComplianceDocumentsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      sendError(res, "Attach at least one document photo or PDF", 400);
      return;
    }
    const results = await bulkUploadComplianceDocuments({
      actor: { id: req.user!.id, role: req.user!.role },
      applicationId: Number(req.params.id),
      files,
      mapping: req.body.mapping,
    });
    sendSuccess(res, "Documents uploaded for the applicant", { results });
  } catch (error: any) {
    sendError(res, error.message, error instanceof BulkUploadRequestError ? 400 : 500);
  }
};

export const updateRequirementDeadlineHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    const { deadline } = req.body;

    if (isNaN(requirementId)) {
      sendError(res, "Invalid requirement ID", 400);
      return;
    }

    const updated = await updateComplianceRequirementDeadline(
      requirementId,
      deadline,
      req.user?.id
    );
    sendSuccess(res, "Compliance requirement deadline updated", updated);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};


export const deleteRequirementHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    if (isNaN(requirementId)) {
      sendError(res, "Invalid requirement ID", 400);
      return;
    }

    const result = await deleteComplianceRequirement(requirementId, req.user?.id);
    sendSuccess(res, "Compliance requirement deleted", result);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const getScopedApplicationsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const scope = (req.query.scope as ComplianceScope) || "ALL";
    const applications = await getScopedComplianceApplications(scope, req.user);
    sendSuccess(res, "Compliance queue retrieved", applications);
  } catch (error: any) {
    sendError(res, error.message || "Failed to fetch compliance applications", 500);
  }
};
