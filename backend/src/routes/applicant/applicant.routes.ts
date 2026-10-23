import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload, uploadImage } from '../../middleware/upload.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { applicantSchema } from '../../schemas/applicant.schema.js';
import {
  getProfile, upsertProfile,
  addWorkExperience, deleteWorkExperience,
  addEducation, deleteEducation,
  updateSkills,
  addTraining, deleteTraining,
  addReference, deleteReference,
  addAsset, deleteAsset,
  uploadPhoto, uploadResume,
  applyExtractedProfile,
  getResumeProposal, applyResumeMerge
} from '../../controllers/applicant/applicant.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/profile", getProfile);
router.post("/profile", validate(applicantSchema.upsertProfile), upsertProfile);
router.post("/profile/apply-extracted", validate(applicantSchema.applyExtractedProfile), applyExtractedProfile);

router.post("/profile/work-experience", validate(applicantSchema.addWorkExperience), addWorkExperience);
router.delete("/profile/work-experience/:id", validate(applicantSchema.idParams), deleteWorkExperience);

router.post("/profile/education", validate(applicantSchema.addEducation), addEducation);
router.delete("/profile/education/:id", validate(applicantSchema.idParams), deleteEducation);

router.post("/profile/skills", validate(applicantSchema.updateSkills), updateSkills);

router.post("/profile/trainings", validate(applicantSchema.addTraining), addTraining);
router.delete("/profile/trainings/:id", validate(applicantSchema.idParams), deleteTraining);

router.post("/profile/references", validate(applicantSchema.addReference), addReference);
router.delete("/profile/references/:id", validate(applicantSchema.idParams), deleteReference);

router.post("/profile/assets", upload.single("file"), validate(applicantSchema.addAsset), addAsset);
router.delete("/profile/assets/:id", validate(applicantSchema.idParams), deleteAsset);
router.post("/profile/photo", uploadImage.single("file"), validate(applicantSchema.emptyUploadBody), uploadPhoto);
router.post("/profile/resume", upload.single("file"), validate(applicantSchema.emptyUploadBody), uploadResume);
router.get("/profile/resume/proposal", getResumeProposal);
router.post("/profile/resume/:parseId/apply", validate(applicantSchema.applyResumeMerge), applyResumeMerge);

export default router;

