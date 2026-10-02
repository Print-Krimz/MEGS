import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { applicantApplicationSchema } from '../../schemas/applicant-application.schema.js';
import {
  getOpenJobs,
  getJobDetails,
  applyToJob,
  getMyApplications,
  getMyApplicationDetails,
  uploadComplianceDocumentHandler,
  getActiveDeployment,
} from '../../controllers/applicant/application.controller.js';
import {
  saveJobHandler,
  unsaveJobHandler,
  listSavedJobsHandler,
  getSavedJobIdsHandler,
} from '../../controllers/applicant/saved-job.controller.js';
import {
  getMyInvitationsHandler,
  respondToInvitationHandler,
} from '../../controllers/applicant/applicant-invitation.controller.js';

const router = Router();

// Publicly browse open job listings
router.get("/jobs", validate(applicantApplicationSchema.listJobs), getOpenJobs);

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/jobs/:id", validate(applicantApplicationSchema.jobParams), getJobDetails);
router.post("/jobs/:id/apply", validate(applicantApplicationSchema.applyParams), upload.single("file"), validate(applicantApplicationSchema.apply), applyToJob);
router.post("/jobs/:id/save", validate(applicantApplicationSchema.jobParams), saveJobHandler);
router.delete("/jobs/:id/save", validate(applicantApplicationSchema.jobParams), unsaveJobHandler);
router.get("/saved-jobs", listSavedJobsHandler);
router.get("/saved-jobs/ids", getSavedJobIdsHandler);
router.get("/active-deployment", getActiveDeployment);
router.get("/invitations", getMyInvitationsHandler);
router.post("/invitations/:id/respond", validate(applicantApplicationSchema.respondInvitation), respondToInvitationHandler);
router.get("/my-applications", getMyApplications);
router.get("/my-applications/:id", validate(applicantApplicationSchema.jobParams), getMyApplicationDetails);
router.get("/applications/:id", validate(applicantApplicationSchema.jobParams), getMyApplicationDetails);
router.post("/compliance/:requirementId/upload", validate(applicantApplicationSchema.complianceUploadParams), upload.single("file"), validate(applicantApplicationSchema.complianceUpload), uploadComplianceDocumentHandler);

export default router;
