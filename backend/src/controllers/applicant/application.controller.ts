import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordBackout, BackoutConflictError } from '../../services/ta/backout.service.js';
import {
  fetchOpenJobs,
  fetchOpenEmployerSummary,
  fetchJobDetails,
  submitApplicationService,
  fetchMyApplications,
  fetchMyDocuments,
  fetchMyDocumentLibrary,
  reuseDocumentForRequirement,
  fetchApplicationDetails,
  uploadApplicantComplianceDocument,
  getActiveDeploymentStatus,
} from '../../services/applicant/application.service.js';

export const getMyDocuments = async (req: Request, res: Response): Promise<void> => {
  try { sendSuccess(res, "Documents retrieved", await fetchMyDocuments(req.user!.id)); }
  catch (error: any) { sendError(res, error.message, 500); }
};

export const getMyDocumentLibrary = async (req: Request, res: Response): Promise<void> => {
  try { sendSuccess(res, "Document library retrieved", await fetchMyDocumentLibrary(req.user!.id)); }
  catch (error: any) { sendError(res, error.message, 500); }
};

// POST /api/applicant-jobs/compliance/:requirementId/reuse - Submit an already-stored document for a requirement
export const reuseComplianceDocumentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    const documentId = parseInt(String(req.body.documentId), 10);
    if (isNaN(requirementId) || isNaN(documentId)) {
      sendError(res, "Invalid requirement or document ID", 400);
      return;
    }
    const updated = await reuseDocumentForRequirement(req.user!.id, requirementId, documentId);
    sendSuccess(res, "Existing document submitted for this requirement", updated);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : error.message.includes("Unauthorized") ? 403 : 400;
    sendError(res, error.message, status);
  }
};

export const getOpenEmployerSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await fetchOpenEmployerSummary();
    sendSuccess(res, "Open employer summary retrieved", summary);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/applicant-jobs/jobs - Browse active job postings
export const getOpenJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const location = typeof req.query.location === "string" ? req.query.location : undefined;
    const jobs = await fetchOpenJobs({
      search,
      location,
      salaryMin: req.query.salaryMin as number | undefined,
      salaryMax: req.query.salaryMax as number | undefined,
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    sendSuccess(res, "Open jobs retrieved", jobs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/applicant-jobs/jobs/:id - Job details and application status
export const getJobDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = parseInt(req.params.id as string, 10);
    if (isNaN(jobId)) {
      sendError(res, "Invalid job ID", 400);
      return;
    }
    const job = await fetchJobDetails(jobId, req.user!.id);
    sendSuccess(res, "Job details retrieved", job);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/applicant-jobs/jobs/:id/apply - Submit application with attached or profile resume
export const applyToJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = parseInt(req.params.id as string, 10);
    if (isNaN(jobId)) {
      sendError(res, "Invalid job ID", 400);
      return;
    }

    const application = await submitApplicationService(jobId, req.user!.id, req.file);
    sendSuccess(res, "Application submitted successfully", application, 201);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 :
                   error.message.includes("already applied") ? 409 :
                   (error.message.includes("currently deployed") || error.message.includes("active assignment")) ? 403 : 400;
    sendError(res, error.message, status);
  }
};

// GET /api/applicant-jobs/my-applications - Applicant's submission history
export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await fetchMyApplications(req.user!.id, {
      summary: req.query.summary === "true",
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });
    sendSuccess(res, "Applications retrieved", applications);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/applicant-jobs/applications/:id - Specific application detail
export const getMyApplicationDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const application = await fetchApplicationDetails(applicationId, req.user!.id);
    sendSuccess(res, "Application details retrieved", application);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, status);
  }
};

// POST /api/applicant/applications/compliance/:requirementId/upload - Upload compliance document
export const uploadComplianceDocumentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const requirementId = parseInt(req.params.requirementId as string, 10);
    if (isNaN(requirementId)) {
      sendError(res, "Invalid compliance requirement ID", 400);
      return;
    }

    if (!req.file) {
      sendError(res, "File upload is required", 400);
      return;
    }

    const updated = await uploadApplicantComplianceDocument(
      req.user!.id,
      requirementId,
      req.file
    );
    sendSuccess(res, "Compliance document uploaded successfully", updated);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : error.message.includes("Unauthorized") ? 403 : 400;
    sendError(res, error.message, status);
  }
};

// GET /api/applicant-jobs/active-deployment - Current candidate's authoritative active deployment status
export const getActiveDeployment = async (req: Request, res: Response): Promise<void> => {
  try {
    const deployment = await getActiveDeploymentStatus(req.user!.id);
    sendSuccess(res, "Active deployment status retrieved", deployment);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};


// POST /api/applicant-jobs/applications/:id/withdraw - Applicant withdraws their own application
export const withdrawApplicationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { reason, notes } = req.body;
    await recordBackout({
      applicationId,
      party: "APPLICANT",
      reason,
      notes,
      actorId: req.user!.id,
      actorRole: "APPLICANT",
    });
    sendSuccess(res, "Application withdrawn", { applicationId, status: "BACKOUT" });
  } catch (error: any) {
    const status = error instanceof BackoutConflictError ? 409 : error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};
