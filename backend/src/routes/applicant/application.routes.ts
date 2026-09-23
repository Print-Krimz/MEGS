import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
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
router.get("/jobs", getOpenJobs);

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/jobs/:id", getJobDetails);
router.post("/jobs/:id/apply", upload.single("file"), applyToJob);
router.post("/jobs/:id/save", saveJobHandler);
router.delete("/jobs/:id/save", unsaveJobHandler);
router.get("/saved-jobs", listSavedJobsHandler);
router.get("/saved-jobs/ids", getSavedJobIdsHandler);
router.get("/active-deployment", getActiveDeployment);
router.get("/invitations", getMyInvitationsHandler);
router.post("/invitations/:id/respond", respondToInvitationHandler);
router.get("/my-applications", getMyApplications);
router.get("/my-applications/:id", getMyApplicationDetails);
router.get("/applications/:id", getMyApplicationDetails);
router.post("/compliance/:requirementId/upload", upload.single("file"), uploadComplianceDocumentHandler);

export default router;
