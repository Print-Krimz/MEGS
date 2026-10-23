import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { uploadFileToSupabase, uploadFileToSupabaseWithInfo } from '../../middleware/upload.middleware.js';
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
  ensureApplicantProfile,
  applyExtractedProfileService
} from '../../services/applicant/applicant.service.js';
import {
  applyMergeDecision,
  getLatestProposal,
  parseResumeToProposal,
  proposalForRow,
  ResumeMergeError,
} from '../../services/applicant/resume-merge.service.js';

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
// The resume is stored and read, but nothing is written to the profile: the result is a proposal
// the applicant reviews and confirms (see applyResumeMerge).
export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) { sendError(res, "No file provided", 400); return; }

    const uploaded = await uploadFileToSupabaseWithInfo("applicant-assets", req.user!.id, file);
    const profile = await ensureApplicantProfile(req.user!.id);
    // Read the resume first so the request is not held up behind the scoring queue that a resume change starts.
    const parse = await parseResumeToProposal({
      profileId: profile.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
      documentId: uploaded.documentId,
      sha256: uploaded.sha256,
      source: "PROFILE_UPLOAD",
    });
    await updateProfileResumeService(req.user!.id, uploaded.url);

    const proposal = parse.status === "PARSED" ? await proposalForRow(parse) : null;
    const finalProfile = await getApplicantProfile(req.user!.id);

    sendSuccess(res, "Resume uploaded. Review the details found before saving them.", {
      profile: finalProfile,
      resumeUrl: uploaded.url,
      parseId: parse.id,
      extractionStatus: parse.status === "PARSED" ? "SUCCESS" : "UNAVAILABLE",
      extractedData: parse.extracted ?? null,
      proposal,
      changeSummary: null,
    });
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

// Latest resume proposal waiting for review, or null.
export const getResumeProposal = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await ensureApplicantProfile(req.user!.id);
    sendSuccess(res, "Resume proposal retrieved", await getLatestProposal(profile.id));
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const applyResumeMerge = async (req: Request, res: Response): Promise<void> => {
  try {
    const profile = await ensureApplicantProfile(req.user!.id);
    const result = await applyMergeDecision({
      parseId: Number(req.params.parseId),
      profileId: profile.id,
      actor: { userId: req.user!.id, role: req.user!.role },
      accept: req.body.accept,
    });
    sendSuccess(res, "Resume details saved", {
      profile: result.profile ?? (await getApplicantProfile(req.user!.id)),
      changeSummary: result.changeSummary,
      accepted: result.accepted,
    });
  } catch (error: any) {
    sendError(res, error.message, error instanceof ResumeMergeError ? error.status : 500);
  }
};


