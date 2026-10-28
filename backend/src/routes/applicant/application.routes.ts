import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { applicantApplicationSchema } from '../../schemas/applicant-application.schema.js';
import {
  getOpenJobs,
  getOpenEmployerSummary,
  getJobDetails,
  applyToJob,
  getMyApplications,
  getMyDocuments,
  getMyDocumentLibrary,
  reuseComplianceDocumentHandler,
  getMyApplicationDetails,
  withdrawApplicationHandler,
  uploadComplianceDocumentHandler,
  getActiveDeployment,
} from '../../controllers/applicant/application.controller.js';
import { createRescheduleRequestHandler } from '../../controllers/applicant/reschedule.controller.js';
import {
  saveJobHandler,
  unsaveJobHandler,
  listSavedJobsHandler,
  getSavedJobIdsHandler,
  clearSavedJobsHandler,
} from '../../controllers/applicant/saved-job.controller.js';
import {
  getMyInvitationsHandler,
  respondToInvitationHandler,
} from '../../controllers/applicant/applicant-invitation.controller.js';

const router = Router();

// Publicly browse open job listings
router.get("/jobs", validate(applicantApplicationSchema.listJobs), getOpenJobs);
router.get("/employers/summary", validate(applicantApplicationSchema.employerSummary), getOpenEmployerSummary);

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/jobs/:id", validate(applicantApplicationSchema.jobParams), getJobDetails);
router.post("/jobs/:id/apply", validate(applicantApplicationSchema.applyParams), upload.single("file"), validate(applicantApplicationSchema.apply), applyToJob);
router.post("/jobs/:id/save", validate(applicantApplicationSchema.jobParams), saveJobHandler);
router.delete("/jobs/:id/save", validate(applicantApplicationSchema.jobParams), unsaveJobHandler);
router.get("/saved-jobs", validate(applicantApplicationSchema.listSavedJobs), listSavedJobsHandler);
router.get("/saved-jobs/ids", getSavedJobIdsHandler);
router.delete("/saved-jobs", clearSavedJobsHandler);
router.get("/active-deployment", getActiveDeployment);
router.get("/invitations", getMyInvitationsHandler);
router.post("/invitations/:id/respond", validate(applicantApplicationSchema.respondInvitation), respondToInvitationHandler);
router.get("/my-applications", validate(applicantApplicationSchema.myApplications), getMyApplications);
router.get("/my-documents", getMyDocuments);
router.get("/my-documents/library", getMyDocumentLibrary);
router.get("/my-applications/:id", validate(applicantApplicationSchema.jobParams), getMyApplicationDetails);
router.get("/applications/:id", validate(applicantApplicationSchema.jobParams), getMyApplicationDetails);
router.post("/applications/:id/withdraw", validate(applicantApplicationSchema.withdraw), withdrawApplicationHandler);
router.post("/applications/:id/reschedule-requests", validate(applicantApplicationSchema.rescheduleRequest), createRescheduleRequestHandler);
router.post("/compliance/:requirementId/reuse", validate(applicantApplicationSchema.complianceReuse), reuseComplianceDocumentHandler);
router.post("/compliance/:requirementId/upload", validate(applicantApplicationSchema.complianceUploadParams), upload.single("file"), validate(applicantApplicationSchema.complianceUpload), uploadComplianceDocumentHandler);

export default router;
