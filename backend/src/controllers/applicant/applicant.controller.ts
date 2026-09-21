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
  processResumeExtractionService,
  applyExtractedProfileService
} from '../../services/applicant/applicant.service.js';

// Profile CRUD (scoped to authenticated user req.user.id)
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await getApplicantProfile(req.user!.id, req.user!.role);
    sendSuccess(res, "Profile retrieved", profile);
  } catch (error: any) {
    sendError(res, error.message, 500);
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

// Central Resume & AI Extraction
export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { sendError(res, "No file provided", 400); return; }

    const resumeUrl = await uploadFileToSupabase("applicant-assets", req.user!.id, file);
    await updateProfileResumeService(req.user!.id, resumeUrl);
    const { extractedData, extractionStatus } = await processResumeExtractionService(file.buffer);

    let finalProfile: any = null;
    let changeSummary: any = null;
    if (extractedData) {
      try {
        const appliedResult = await applyExtractedProfileService(req.user!.id, {
          personalDetails: {
            firstName: extractedData.firstName,
            middleName: extractedData.middleName,
            lastName: extractedData.lastName,
            mobileNumber: extractedData.mobileNumber,
            gender: extractedData.gender,
            province: extractedData.province,
            city: extractedData.city,
            dateOfBirth: extractedData.dateOfBirth,
            birthPlace: extractedData.birthPlace,
            nationality: extractedData.nationality,
            civilStatus: extractedData.civilStatus,
            religion: extractedData.religion,
            height: extractedData.height,
            weight: extractedData.weight,
            address: extractedData.address,
            preferredWorkLocations: extractedData.preferredWorkLocations,
            professionalSummary: extractedData.professionalSummary,
          },
          workExperiences: extractedData.workExperiences?.map((we) => ({
            company: we.company,
            roleTitle: we.roleTitle,
            location: we.location,
            startDate: we.startDate || new Date().toISOString().split("T")[0],
            endDate: we.endDate,
            isCurrent: we.isCurrent,
            summary: we.summary,
          })),
          educations: extractedData.educations,
          skills: extractedData.skills,
          trainings: extractedData.trainings,
          characterReferences: extractedData.characterReferences,
          overwriteExistingPersonal: true,
        });
        finalProfile = appliedResult.profile;
        changeSummary = appliedResult.changeSummary;
      } catch (applyErr: any) {
        console.warn("[Resume Auto-Fill] Failed to auto-apply extracted details:", applyErr.message);
      }
    }

    if (!finalProfile) {
      finalProfile = await getApplicantProfile(req.user!.id);
    }

    sendSuccess(res, "Resume uploaded and profile auto-filled successfully", {
      profile: finalProfile,
      resumeUrl,
      extractedData,
      extractionStatus,
      changeSummary,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

// Apply Extracted Resume Data to Profile
export const applyExtractedProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profile: updatedProfile, changeSummary } = await applyExtractedProfileService(req.user!.id, req.body);
    sendSuccess(res, "Extracted profile details applied successfully", {
      profile: updatedProfile,
      changeSummary,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};


