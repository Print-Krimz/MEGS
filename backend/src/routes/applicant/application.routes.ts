import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import {
  getOpenJobs,
  getJobDetails,
  applyToJob,
  getMyApplications,
} from '../../controllers/applicant/application.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("APPLICANT"));

router.get("/jobs", getOpenJobs);
router.get("/jobs/:id", getJobDetails);
router.post("/jobs/:id/apply", upload.single("file"), applyToJob);
router.get("/my-applications", getMyApplications);

export default router;
