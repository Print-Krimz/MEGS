import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  fetchOpenJobs,
  fetchJobDetails,
  submitApplicationService,
  fetchMyApplications,
  fetchApplicationDetails,
  uploadApplicantComplianceDocument
} from '../../services/applicant/application.service.js';
import { getApplicantProfile } from '../../services/applicant/applicant.service.js';

// GET /api/applicant-jobs/jobs - Browse active job postings
export const getOpenJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobs = await fetchOpenJobs();
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

    const profile = await getApplicantProfile(req.user!.id);
    if (!profile) {
      sendError(res, "Profile not found. Please complete your profile first.", 400);
      return;
    }

    const application = await submitApplicationService(jobId, req.user!.id, req.file);
    sendSuccess(res, "Application submitted successfully", application, 201);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 :
                   error.message.includes("already applied") ? 409 : 400;
    sendError(res, error.message, status);
  }
};

// GET /api/applicant-jobs/my-applications - Applicant's submission history
export const getMyApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const applications = await fetchMyApplications(req.user!.id);
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
