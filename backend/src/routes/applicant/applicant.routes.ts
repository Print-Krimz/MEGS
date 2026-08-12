import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
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
  setAiConsent
} from '../../controllers/applicant/applicant.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/profile", getProfile);
router.post("/profile", validate(applicantSchema.upsertProfile), upsertProfile);

router.post("/profile/work-experience", validate(applicantSchema.addWorkExperience), addWorkExperience);
router.delete("/profile/work-experience/:id", deleteWorkExperience);

router.post("/profile/education", validate(applicantSchema.addEducation), addEducation);
router.delete("/profile/education/:id", deleteEducation);

router.post("/profile/skills", validate(applicantSchema.updateSkills), updateSkills);

router.post("/profile/trainings", validate(applicantSchema.addTraining), addTraining);
router.delete("/profile/trainings/:id", deleteTraining);

router.post("/profile/references", validate(applicantSchema.addReference), addReference);
router.delete("/profile/references/:id", deleteReference);

router.post("/profile/assets", upload.single("file"), validate(applicantSchema.addAsset), addAsset);
router.delete("/profile/assets/:id", deleteAsset);
router.post("/profile/photo", upload.single("file"), uploadPhoto);
router.post("/profile/resume", upload.single("file"), uploadResume);
router.post("/profile/consent", setAiConsent);

export default router;
