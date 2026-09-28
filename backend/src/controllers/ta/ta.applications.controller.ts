import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import prisma from '../../utils/prisma.js';
import { logAudit } from '../../utils/audit.js';
import {
  listTAApplications,
  getTAApplication,
  updateTAApplicationStatus,
  archiveTAApplication,
  restoreTAApplication,
  getRecruiterDecisionsService,
  signApplicationContract,
  completeApplicationOrientation
} from '../../services/ta/ta.applications.service.js';

// GET /api/ta/applications - List and filter applications across postings
export const listApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, jobPostingId, jobId, clientId, search, isArchived, page, limit, mineOnly } = req.query;
    const currentUserId = req.user?.id;
    const result = await listTAApplications({
      status: status as string,
      jobPostingId: (jobPostingId || jobId) as string,
      clientId: clientId ? parseInt(clientId as string, 10) : undefined,
      search: search as string,
      isArchived: isArchived !== undefined ? isArchived === "true" : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      mineOnly: mineOnly === "true",
      currentUserId,
    });
    sendSuccess(res, "Applications retrieved", result);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/ta/applications/:id - Comprehensive candidate profile, scores, and interviews
export const getApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const formatted = await getTAApplication(id);
    sendSuccess(res, "Application retrieved", formatted);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// PATCH /api/ta/applications/:id/status - Move candidate through pipeline stages
export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { status, reason } = req.body;
    if (!status) {
      sendError(res, "status is required", 400);
      return;
    }
    const updated = await updateTAApplicationStatus(id, status, req.user!.id, reason);
    sendSuccess(res, `Application moved to ${updated.status}`, updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

export const getRecruiterDecisionsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const decisions = await getRecruiterDecisionsService(id);
    sendSuccess(res, "Recruiter decisions retrieved", decisions);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// PATCH /api/ta/applications/:id/archive - Soft-archive candidate record
export const archiveApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const updated = await archiveTAApplication(id);
    sendSuccess(res, "Application archived", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/applications/:id/restore - Restore soft-archived candidate to SUBMITTED
export const restoreApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const updated = await restoreTAApplication(id);
    sendSuccess(res, "Application restored to pipeline", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// POST /api/ta/applications/:id/contract/sign - Record employment contract signed
export const signContractHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { contractNotes, contractDocumentUrl } = req.body || {};
    const updated = await signApplicationContract(id, { contractNotes, contractDocumentUrl }, req.user!.id);
    sendSuccess(res, "Employment contract marked as signed", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// POST /api/ta/applications/:id/orientation/complete - Record candidate orientation complete
export const completeOrientationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { orientationDate, orientationNotes } = req.body || {};
    const updated = await completeApplicationOrientation(id, { orientationDate, orientationNotes }, req.user!.id);
    sendSuccess(res, "Orientation marked as completed", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/ta/candidates/:id - Verify and update candidate profile
export const updateCandidateProfileHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!idParam) {
      sendError(res, "Candidate ID is required", 400);
      return;
    }

    const numId = parseInt(idParam, 10);
    let profile = null;

    if (!isNaN(numId)) {
      profile = await prisma.applicantProfile.findUnique({
        where: { id: numId },
      });
    }

    if (!profile) {
      profile = await prisma.applicantProfile.findFirst({
        where: { userId: idParam },
      });
    }

    if (!profile) {
      sendError(res, "Applicant profile not found", 404);
      return;
    }

    const {
      firstName,
      lastName,
      middleName,
      mobileNumber,
      dateOfBirth,
      gender,
      city,
      province,
      tattooStatus,
    } = req.body || {};

    const updateData: Record<string, any> = {};
    const changes: Record<string, { from: any; to: any }> = {};

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim() === "") {
        sendError(res, "First name cannot be empty", 400);
        return;
      }
      const trimmed = firstName.trim();
      if (profile.firstName !== trimmed) {
        changes.firstName = { from: profile.firstName, to: trimmed };
        updateData.firstName = trimmed;
      }
    }

    if (lastName !== undefined) {
      if (typeof lastName !== "string" || lastName.trim() === "") {
        sendError(res, "Last name cannot be empty", 400);
        return;
      }
      const trimmed = lastName.trim();
      if (profile.lastName !== trimmed) {
        changes.lastName = { from: profile.lastName, to: trimmed };
        updateData.lastName = trimmed;
      }
    }

    if (middleName !== undefined) {
      const val = typeof middleName === "string" ? middleName.trim() || null : null;
      if (profile.middleName !== val) {
        changes.middleName = { from: profile.middleName, to: val };
        updateData.middleName = val;
      }
    }

    if (mobileNumber !== undefined) {
      const val = typeof mobileNumber === "string" ? mobileNumber.trim() || null : null;
      if (val) {
        const digits = val.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 12) {
          sendError(res, "Contact phone must not exceed 11 digits", 400);
          return;
        }
      }
      if (profile.mobileNumber !== val) {
        changes.mobileNumber = { from: profile.mobileNumber, to: val };
        updateData.mobileNumber = val;
      }
    }

    if (dateOfBirth !== undefined) {
      let parsedDate: Date | null = null;
      if (dateOfBirth) {
        parsedDate = new Date(dateOfBirth);
        if (isNaN(parsedDate.getTime())) {
          sendError(res, "Invalid dateOfBirth format", 400);
          return;
        }
      }
      const currentIso = profile.dateOfBirth?.toISOString();
      const nextIso = parsedDate?.toISOString();
      if (currentIso !== nextIso) {
        changes.dateOfBirth = { from: profile.dateOfBirth, to: parsedDate };
        updateData.dateOfBirth = parsedDate;
      }
    }

    if (gender !== undefined) {
      const val = typeof gender === "string" ? gender.trim() || null : null;
      if (profile.gender !== val) {
        changes.gender = { from: profile.gender, to: val };
        updateData.gender = val;
      }
    }

    if (city !== undefined) {
      const val = typeof city === "string" ? city.trim() || null : null;
      if (profile.city !== val) {
        changes.city = { from: profile.city, to: val };
        updateData.city = val;
      }
    }

    if (province !== undefined) {
      const val = typeof province === "string" ? province.trim() || null : null;
      if (profile.province !== val) {
        changes.province = { from: profile.province, to: val };
        updateData.province = val;
      }
    }

    if (tattooStatus !== undefined) {
      const val = typeof tattooStatus === "string" ? tattooStatus.trim().toUpperCase() || null : null;
      if (val !== null && !["NONE", "NON_VISIBLE", "VISIBLE"].includes(val)) {
        sendError(res, "Tattoo status must be NONE, NON_VISIBLE, VISIBLE, or null", 400);
        return;
      }
      if (profile.tattooStatus !== val) {
        changes.tattooStatus = { from: profile.tattooStatus, to: val };
        updateData.tattooStatus = val;
      }
    }

    const updatedProfile = await prisma.applicantProfile.update({
      where: { id: profile.id },
      data: updateData,
    });

    const actorId = req.user?.id || "system";
    await logAudit(actorId, "TA_CANDIDATE_PROFILE_VERIFIED", "ApplicantProfile", profile.id, {
      changes,
    });

    sendSuccess(res, "Candidate profile verified and updated successfully", updatedProfile);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

