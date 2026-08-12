import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  listTAJobs,
  createTAJob,
  getTAJob,
  updateTAJob,
  updateTAJobStatus
} from '../../services/ta/ta.jobs.service.js';

// GET /api/ta/jobs - List job postings with active applicant counts
export const listJobs = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const jobs = await listTAJobs(status);
    sendSuccess(res, "Job postings retrieved", jobs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/ta/jobs - Create job posting (defaults to DRAFT)
export const createJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await createTAJob(req.user!.id, req.body);
    sendSuccess(res, `Job posting created with status: ${job.status}`, job, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// GET /api/ta/jobs/:id - Job details with associated applicants
export const getJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = parseInt(req.params.id as string, 10);
    if (isNaN(jobId)) {
      sendError(res, "Invalid job ID", 400);
      return;
    }
    const job = await getTAJob(jobId);
    sendSuccess(res, "Job posting retrieved", job);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/jobs/:id - Update content of DRAFT or OPEN job posting
export const updateJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = parseInt(req.params.id as string, 10);
    if (isNaN(jobId)) {
      sendError(res, "Invalid job ID", 400);
      return;
    }
    const updated = await updateTAJob(jobId, req.body);
    sendSuccess(res, "Job posting updated", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/jobs/:id/status - Lifecycle transitions: DRAFT -> OPEN <-> CLOSED
export const updateJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const jobId = parseInt(req.params.id as string, 10);
    if (isNaN(jobId)) {
      sendError(res, "Invalid job ID", 400);
      return;
    }
    const updated = await updateTAJobStatus(jobId, req.body.status);
    sendSuccess(res, `Job posting is now ${updated.status}`, updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};
