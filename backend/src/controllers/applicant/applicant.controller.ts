import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';
import {
  getApplicantProfile,
  upsertApplicantProfile,
  addWorkExperienceService,
  deleteWorkExperienceService,
  addEducationService,
  deleteEducationService,
  updateSkillsService,
  addTrainingService,
  deleteTrainingService,
  addReferenceService,
  deleteReferenceService,
  addAssetService,
  deleteAssetService,
  updateProfilePhotoService,
  updateProfileResumeService,
  setAiConsentService
} from '../../services/applicant/applicant.service.js';

// Profile CRUD (scoped to authenticated user req.user.id)
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await getApplicantProfile(req.user!.id);
    sendSuccess(res, "Profile retrieved", profile);
  } catch (error: any) {
    sendError(res, error.message, 404);
  }
};

export const upsertProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await upsertApplicantProfile(req.user!.id, req.body);
    sendSuccess(res, "Profile updated successfully", profile);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Work Experience
export const addWorkExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    const exp = await addWorkExperienceService(req.user!.id, req.body);
    sendSuccess(res, "Work experience added", exp, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const deleteWorkExperience = async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteWorkExperienceService(req.user!.id, parseInt(req.params.id as string));
    sendSuccess(res, "Work experience deleted", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Education
export const addEducation = async (req: Request, res: Response): Promise<void> => {
  try {
    const edu = await addEducationService(req.user!.id, req.body);
    sendSuccess(res, "Education added", edu, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const deleteEducation = async (req: Request, res: Response): Promise<void> => {
  try {
    await deleteEducationService(req.user!.id, parseInt(req.params.id as string));
    sendSuccess(res, "Education deleted", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Skills sync
export const updateSkills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { skills } = req.body;
    const currentSkills = await updateSkillsService(req.user!.id, skills);
    sendSuccess(res, "Skills updated successfully", currentSkills);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Trainings & Certifications
export const addTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const trng = await addTrainingService(req.user!.id, req.body);
    sendSuccess(res, "Training added", trng, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

export const deleteTraining = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await deleteTrainingService(req.user!.id, id);
    sendSuccess(res, "Training deleted", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Character References
export const addReference = async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await addReferenceService(req.user!.id, req.body);
    sendSuccess(res, "Reference added", ref, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

export const deleteReference = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await deleteReferenceService(req.user!.id, id);
    sendSuccess(res, "Reference deleted", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Assets & Documents
export const addAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    const { label, notes } = req.body;

    if (!file) { sendError(res, "No file provided", 400); return; }

    const fileUrl = await uploadFileToSupabase("applicant-assets", req.user!.id, file);
    const asset = await addAssetService(req.user!.id, fileUrl, { label, notes });
    sendSuccess(res, "Asset uploaded and saved", asset, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string);
    await deleteAssetService(req.user!.id, id);
    sendSuccess(res, "Asset record deleted", null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// Profile Photo
export const uploadPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { sendError(res, "No file provided", 400); return; }

    const photoUrl = await uploadFileToSupabase("applicant-assets", req.user!.id, file);
    const updatedProfile = await updateProfilePhotoService(req.user!.id, photoUrl);
    sendSuccess(res, "Photo uploaded successfully", updatedProfile);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

// Central Resume (Requires prior AI consent)
export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { sendError(res, "No file provided", 400); return; }

    const profile = await getApplicantProfile(req.user!.id);
    if (!profile.hasConsentedToAi) {
      sendError(res, "You must consent to AI processing before uploading a resume.", 403);
      return;
    }

    const resumeUrl = await uploadFileToSupabase("applicant-assets", req.user!.id, file);
    const updatedProfile = await updateProfileResumeService(req.user!.id, resumeUrl);
    sendSuccess(res, "Default resume uploaded successfully", updatedProfile);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

// AI Consent Status
export const setAiConsent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { consent } = req.body;
    if (typeof consent !== "boolean") {
      sendError(res, "Consent must be a boolean value", 400);
      return;
    }
    const updated = await setAiConsentService(req.user!.id, consent);
    sendSuccess(res, "AI consent updated", { hasConsentedToAi: updated.hasConsentedToAi });
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

