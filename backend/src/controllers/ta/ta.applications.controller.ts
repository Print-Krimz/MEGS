import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import prisma from '../../utils/prisma.js';
import { recordBackout, BackoutConflictError } from '../../services/ta/backout.service.js';
import { logAudit } from '../../utils/audit.js';
import { validateStructuredAddress } from '../../utils/address-validation.js';
import { isValidDateOnly, manilaDateString, parseManilaDateOnly } from '../../schemas/field-limits.js';
import {
  listTAApplications,
  getTAApplication,
  updateTAApplicationStatus,
  archiveTAApplication,
  restoreTAApplication,
  getRecruiterDecisionsService,
  getContractPdf,
  recordSignedContract,
} from '../../services/ta/ta.applications.service.js';

// GET /api/ta/applications - List and filter applications across postings
export const listApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, jobPostingId, jobId, clientId, search, isArchived, page, limit, mineOnly, summary } = req.query;
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
      summary: summary === "true",
      currentUserId,
      actor: req.user,
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
    const { status, reason, reasonCode } = req.body;
    if (!status) {
      sendError(res, "status is required", 400);
      return;
    }
    const updated = await updateTAApplicationStatus(id, status, req.user!.id, reason, reasonCode);
    sendSuccess(res, `Application moved to ${updated.status}`, updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

// POST /api/ta/applications/:id/backout - Record a backout with responsible party and reason
export const recordBackoutHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { party, reason, notes, occurredOn } = req.body;
    const today = manilaDateString();
    const occurredAt = !occurredOn || occurredOn === today ? new Date() : parseManilaDateOnly(occurredOn);
    const backout = await recordBackout({
      applicationId,
      party,
      reason,
      notes,
      occurredAt,
      actorId: req.user!.id,
      actorRole: req.user!.role as "TALENT_ACQUISITION" | "ADMINISTRATOR",
    });
    sendSuccess(res, "Backout recorded", backout, 201);
  } catch (error: any) {
    const status = error instanceof BackoutConflictError ? 409 : error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
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
    const archiveReason = req.body?.reason ?? req.body?.notes;
    const updated = await archiveTAApplication(id, req.user!.id, archiveReason);
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

const contractStatusCode = (message: string) => (message.includes("not found") ? 404 : 400);

// GET /api/ta/applications/:id/contract/pdf - Optional printable copy (rate left blank)
export const downloadContractPdfHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const { buffer, fileName } = await getContractPdf(id, startDate);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    sendError(res, error.message, contractStatusCode(error.message));
  }
};

// POST /api/ta/applications/:id/contract/signed - Upload the signed scan and deploy
export const uploadSignedContractHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    if (!req.file) {
      sendError(res, "No signed contract file provided", 400);
      return;
    }
    const { startDate } = req.body || {};
    const updated = await recordSignedContract(id, req.file, { startDate }, req.user!.id);
    sendSuccess(res, "Signed contract recorded and candidate deployed", updated);
  } catch (error: any) {
    sendError(res, error.message, contractStatusCode(error.message));
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
      barangay,
      postalCode,
      tattooStatus,
      sss,
      philhealth,
      pagibig,
      tin,
      address,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelationship,
      emergencyContactAddress,
    } = req.body || {};

    // Address problems are user input errors (400), not server failures.
    try {
      validateStructuredAddress({
        province: province !== undefined ? province : profile.province,
        city: city !== undefined ? city : profile.city,
        barangay: barangay !== undefined ? barangay : profile.barangay,
        postalCode: postalCode !== undefined ? postalCode : profile.postalCode,
        address: address !== undefined ? address : profile.address,
      }, profile);
    } catch (validationError: any) {
      sendError(res, validationError.message, 400);
      return;
    }

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
      const nextDob = typeof dateOfBirth === "string" ? dateOfBirth.slice(0, 10) : "";
      const previousDob = profile.dateOfBirth?.toISOString().slice(0, 10);
      if (dateOfBirth && nextDob !== previousDob && (!isValidDateOnly(nextDob) || nextDob >= manilaDateString())) {
        sendError(res, "Date of birth must be a valid date before today", 400);
        return;
      }
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

    if (sss !== undefined) {
      const val = typeof sss === "string" ? sss.trim() || null : null;
      if (profile.sss !== val) {
        changes.sss = { from: profile.sss, to: val };
        updateData.sss = val;
      }
    }

    if (philhealth !== undefined) {
      const val = typeof philhealth === "string" ? philhealth.trim() || null : null;
      if (profile.philhealth !== val) {
        changes.philhealth = { from: profile.philhealth, to: val };
        updateData.philhealth = val;
      }
    }

    if (pagibig !== undefined) {
      const val = typeof pagibig === "string" ? pagibig.trim() || null : null;
      if (profile.pagibig !== val) {
        changes.pagibig = { from: profile.pagibig, to: val };
        updateData.pagibig = val;
      }
    }

    if (tin !== undefined) {
      const val = typeof tin === "string" ? tin.trim() || null : null;
      if (profile.tin !== val) {
        changes.tin = { from: profile.tin, to: val };
        updateData.tin = val;
      }
    }

    if (address !== undefined) {
      const val = typeof address === "string" ? address.trim() || null : null;
      if (profile.address !== val) {
        changes.address = { from: profile.address, to: val };
        updateData.address = val;
      }
    }

    if (barangay !== undefined) {
      const val = typeof barangay === "string" ? barangay.trim() || null : null;
      if (profile.barangay !== val) {
        changes.barangay = { from: profile.barangay, to: val };
        updateData.barangay = val;
      }
    }

    if (postalCode !== undefined) {
      const val = typeof postalCode === "string" ? postalCode.trim() || null : null;
      if (profile.postalCode !== val) {
        changes.postalCode = { from: profile.postalCode, to: val };
        updateData.postalCode = val;
      }
    }

    if (emergencyContactName !== undefined) {
      const val = typeof emergencyContactName === "string" ? emergencyContactName.trim() || null : null;
      if (profile.emergencyContactName !== val) {
        changes.emergencyContactName = { from: profile.emergencyContactName, to: val };
        updateData.emergencyContactName = val;
      }
    }

    if (emergencyContactPhone !== undefined) {
      const val = typeof emergencyContactPhone === "string" ? emergencyContactPhone.trim() || null : null;
      if (val) {
        const digits = val.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 12) {
          sendError(res, "Contact phone must not exceed 11 digits", 400);
          return;
        }
      }
      if (profile.emergencyContactPhone !== val) {
        changes.emergencyContactPhone = { from: profile.emergencyContactPhone, to: val };
        updateData.emergencyContactPhone = val;
      }
    }

    if (emergencyContactRelationship !== undefined) {
      const val = typeof emergencyContactRelationship === "string" ? emergencyContactRelationship.trim() || null : null;
      if (profile.emergencyContactRelationship !== val) {
        changes.emergencyContactRelationship = { from: profile.emergencyContactRelationship, to: val };
        updateData.emergencyContactRelationship = val;
      }
    }

    if (emergencyContactAddress !== undefined) {
      const val = typeof emergencyContactAddress === "string" ? emergencyContactAddress.trim() || null : null;
      if (profile.emergencyContactAddress !== val) {
        changes.emergencyContactAddress = { from: profile.emergencyContactAddress, to: val };
        updateData.emergencyContactAddress = val;
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

