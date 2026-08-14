import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { taSchema } from '../../schemas/ta.schema.js';

import {
  listJobs,
  createJob,
  getJob,
  updateJob,
  updateJobStatus,
} from '../../controllers/ta/ta.jobs.controller.js';

import {
  listApplications,
  getApplication,
  updateApplicationStatus,
  archiveApplication,
  restoreApplication,
  getRecruiterDecisionsHandler,
} from '../../controllers/ta/ta.applications.controller.js';

import { analyzeApplication } from '../../controllers/ta/ta.ai.controller.js';

import {
  listInterviews,
  scheduleInterview,
  updateInterviewStatus,
  checkInterviewCompliance,
} from '../../controllers/ta/ta.interviews.controller.js';

import {
  startOnboarding,
  uploadPostHireDocument,
  completeHiring,
} from '../../controllers/ta/ta.posthire.controller.js';
import {
  addCandidateToPool,
  considerCandidateForJob,
  getRankedCandidates,
  getSimilarCandidates,
  getTalentPool,
  rankCandidates,
  recordContact,
  searchTalentPool,
} from '../../controllers/ta/candidate-scoring.ta.controller.js';

import {
  listClientsHandler,
  createClientHandler,
  getClientDetailsHandler,
  updateClientHandler,
} from '../../controllers/ta/ta.clients.controller.js';

import {
  listMRFsHandler,
  createMRFHandler,
  getMRFDetailsHandler,
  updateMRFHandler,
  linkJobToMRFHandler,
  addMRFComplianceTemplateHandler,
  listMRFComplianceTemplatesHandler,
  removeMRFComplianceTemplateHandler,
} from '../../controllers/ta/ta.mrf.controller.js';

import {
  recordEndorsementHandler,
  listEndorsementsHandler,
} from '../../controllers/ta/ta.endorsement.controller.js';

import {
  createRequirementHandler,
  listRequirementsHandler,
  submitDocumentHandler,
  reviewRequirementHandler,
} from '../../controllers/ta/ta.compliance.controller.js';

import {
  createDeploymentHandler,
  updateDeploymentStatusHandler,
  listDeploymentsHandler,
  getDeploymentDetailsHandler,
} from '../../controllers/ta/ta.deployments.controller.js';

import {
  getPipelineStatsHandler,
  getTimeToFillStatsHandler,
  getDeploymentStatsHandler,
  getComplianceOverviewHandler,
  exportPipelineReportHandler,
  exportDeploymentReportHandler,
} from '../../controllers/ta/ta.analytics.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"));

// Client & MRF Management
router.get("/clients", listClientsHandler);
router.post("/clients", createClientHandler);
router.get("/clients/:id", getClientDetailsHandler);
router.patch("/clients/:id", updateClientHandler);

router.get("/mrfs", listMRFsHandler);
router.post("/mrfs", createMRFHandler);
router.get("/mrfs/:id", getMRFDetailsHandler);
router.patch("/mrfs/:id", updateMRFHandler);
router.post("/mrfs/:id/link-job", linkJobToMRFHandler);
router.post("/mrfs/:id/compliance-templates", validate(taSchema.createComplianceTemplate), addMRFComplianceTemplateHandler);
router.get("/mrfs/:id/compliance-templates", listMRFComplianceTemplatesHandler);
router.delete("/mrfs/compliance-templates/:templateId", removeMRFComplianceTemplateHandler);

// Job Postings & Candidate Scoring
router.get("/jobs", listJobs);
router.post("/jobs", validate(taSchema.createJob), createJob);
router.get("/jobs/:id", getJob);
router.patch("/jobs/:id", validate(taSchema.updateJob), updateJob);
router.patch("/jobs/:id/status", validate(taSchema.updateStatus), updateJobStatus);
router.post("/jobs/:jobId/rank-candidates", rankCandidates);
router.get("/jobs/:jobId/ranked-candidates", getRankedCandidates);
router.get("/jobs/:jobId/talent-pool", getTalentPool);
router.get("/candidates/:candidateId/similar", getSimilarCandidates);
router.post("/talent-pool/search", searchTalentPool);
router.post("/talent-pool/members", addCandidateToPool);
router.post("/talent-pool/contacts", recordContact);
router.post("/talent-pool/consider", considerCandidateForJob);

// Application Pipeline & Recruiter Decisions
router.get("/applications", listApplications);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id/status", validate(taSchema.updateStatus), updateApplicationStatus);
router.patch("/applications/:id/archive", validate(taSchema.archiveRestore), archiveApplication);
router.patch("/applications/:id/restore", validate(taSchema.archiveRestore), restoreApplication);
router.get("/applications/:id/decisions", getRecruiterDecisionsHandler);

// Client Endorsement
router.post("/applications/:id/endorse", validate(taSchema.endorseCandidate), recordEndorsementHandler);
router.get("/applications/:id/endorsements", listEndorsementsHandler);

// AI Resume Scoring
router.post("/applications/:id/analyze", analyzeApplication);

// Interview Scheduling & Compliance
router.get("/compliance/interviews", checkInterviewCompliance);
router.get("/applications/:id/interviews", listInterviews);
router.post("/applications/:id/interviews", validate(taSchema.scheduleInterview), scheduleInterview);
router.patch("/applications/:id/interviews/:interviewId/status", validate(taSchema.updateInterviewStatus), updateInterviewStatus);

// Compliance Checklist
router.post("/applications/:id/compliance", createRequirementHandler);
router.get("/applications/:id/compliance", listRequirementsHandler);
router.post("/compliance/:requirementId/submit", submitDocumentHandler);
router.patch("/compliance/:requirementId/review", reviewRequirementHandler);

// Deployment Lifecycle
router.post("/applications/:id/deploy", createDeploymentHandler);
router.patch("/deployments/:id/status", updateDeploymentStatusHandler);
router.get("/deployments", listDeploymentsHandler);
router.get("/deployments/:id", getDeploymentDetailsHandler);

// Analytics & Reports
router.get("/analytics/pipeline", getPipelineStatsHandler);
router.get("/analytics/time-to-fill", getTimeToFillStatsHandler);
router.get("/analytics/deployments", getDeploymentStatsHandler);
router.get("/analytics/compliance", getComplianceOverviewHandler);
router.get("/reports/pipeline", exportPipelineReportHandler);
router.get("/reports/deployments", exportDeploymentReportHandler);

// Post-Hire & Vault 201
router.patch("/applications/:id/onboard", startOnboarding);
router.post("/applications/:id/documents", upload.single("file"), validate(taSchema.uploadPostHireDocument), uploadPostHireDocument);
router.post("/applications/:id/hire", validate(taSchema.completeHiring), completeHiring);

export default router;
