import { Router } from "express";
import { authenticateJWT, authenticateOptionalJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import {
  getOpenJobs,
  getJobDetails,
  applyToJob,
  getMyApplications,
  getMyApplicationDetails,
  uploadComplianceDocumentHandler,
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

// Public / Guest job browsing (attaches req.user if token is present)
router.get("/jobs", authenticateOptionalJWT, getOpenJobs);
router.get("/jobs/:id", authenticateOptionalJWT, getJobDetails);

// Protected applicant-only routes
router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.post("/jobs/:id/apply", upload.single("file"), applyToJob);
router.post("/jobs/:id/save", saveJobHandler);
router.delete("/jobs/:id/save", unsaveJobHandler);
router.get("/saved-jobs", listSavedJobsHandler);
router.get("/saved-jobs/ids", getSavedJobIdsHandler);
router.get("/invitations", getMyInvitationsHandler);
router.post("/invitations/:id/respond", respondToInvitationHandler);
router.get("/my-applications", getMyApplications);
router.get("/my-applications/:id", getMyApplicationDetails);
router.get("/applications/:id", getMyApplicationDetails);
router.post("/compliance/:requirementId/upload", upload.single("file"), uploadComplianceDocumentHandler);

export default router;
