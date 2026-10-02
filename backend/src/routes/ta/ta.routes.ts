import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload } from '../../middleware/upload.middleware.js';
import { validate, validateDateRangeQuery } from '../../middleware/validate.middleware.js';
import { taSchema } from '../../schemas/ta.schema.js';
import { analyticsSchema } from '../../schemas/analytics.schema.js';
import { candidateScoringRouteSchema } from '../../schemas/candidate-scoring.schema.js';
import { talentPoolInvitationRouteSchema } from '../../schemas/talent-pool-invitation.schema.js';

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
  signContractHandler,
  completeOrientationHandler,
  updateCandidateProfileHandler,
} from '../../controllers/ta/ta.applications.controller.js';

import { analyzeApplication } from '../../controllers/ta/ta.ai.controller.js';

import {
  listInterviews,
  scheduleInterview,
  updateInterviewStatus,
  recordInterviewDirectly,
  checkInterviewCompliance,
} from '../../controllers/ta/ta.interviews.controller.js';

import {
  uploadPostHireDocument,
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
  sendInvitationHandler,
  batchSendInvitationsHandler,
  listInvitationsHandler,
  cancelInvitationHandler,
  expireOverdueInvitationsHandler,
} from '../../controllers/ta/talent-pool-invitation.ta.controller.js';

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
  addMRFComplianceTemplatesBulkHandler,
  listMRFComplianceTemplatesHandler,
  removeMRFComplianceTemplateHandler,
} from '../../controllers/ta/ta.mrf.controller.js';

import {
  recordEndorsementHandler,
  listEndorsementsHandler,
  updateEndorsementHandler,
} from '../../controllers/ta/ta.endorsement.controller.js';

import {
  createRequirementHandler,
  listRequirementsHandler,
  submitDocumentHandler,
  reviewRequirementHandler,
  updateRequirementDeadlineHandler,
  deleteRequirementHandler,
} from '../../controllers/ta/ta.compliance.controller.js';

import {
  createDeploymentHandler,
  updateDeploymentStatusHandler,
  listDeploymentsHandler,
  getDeploymentDetailsHandler,
  signDeploymentContractHandler,
  updateDeploymentContractHandler,
  fastTrackRedeploymentHandler,
} from '../../controllers/ta/ta.deployments.controller.js';

import {
  getPipelineStatsHandler,
  getTimeToFillStatsHandler,
  getDeploymentStatsHandler,
  getComplianceOverviewHandler,
  exportPipelineReportHandler,
  exportDeploymentReportHandler,
  getTAOverviewHandler,
  getTAActivityTrendHandler,
  getTAPipelineFunnelHandler,
  getTAPendingActionsHandler,
  getTAFilterOptionsHandler,
  getTADashboardSummaryHandler,
} from '../../controllers/ta/ta.analytics.controller.js';

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("TALENT_ACQUISITION"));
router.use(validateDateRangeQuery);

// Client & MRF Management
router.get("/clients", validate(taSchema.listClients), listClientsHandler);
router.post("/clients", validate(taSchema.createClient), createClientHandler);
router.get("/clients/:id", validate(taSchema.idParams), getClientDetailsHandler);
router.patch("/clients/:id", validate(taSchema.updateClient), updateClientHandler);

router.get("/mrfs", validate(taSchema.listMRFs), listMRFsHandler);
router.post("/mrfs", validate(taSchema.createMRF), createMRFHandler);
router.get("/mrfs/:id", validate(taSchema.idParams), getMRFDetailsHandler);
router.patch("/mrfs/:id", validate(taSchema.updateMRF), updateMRFHandler);
router.post("/mrfs/:id/link-job", validate(taSchema.linkJobToMRF), linkJobToMRFHandler);
router.post("/mrfs/:id/compliance-templates/bulk", validate(taSchema.createComplianceTemplatesBulk), addMRFComplianceTemplatesBulkHandler);
router.post("/mrfs/:id/compliance-templates", validate(taSchema.createComplianceTemplate), addMRFComplianceTemplateHandler);
router.get("/mrfs/:id/compliance-templates", validate(taSchema.idParams), listMRFComplianceTemplatesHandler);
router.delete("/mrfs/compliance-templates/:templateId", validate(taSchema.deleteMrfComplianceTemplate), removeMRFComplianceTemplateHandler);

// Job Postings & Candidate Scoring
router.get("/jobs", validate(taSchema.listJobs), listJobs);
router.post("/jobs", validate(taSchema.createJob), createJob);
router.get("/jobs/:id", validate(taSchema.idParams), getJob);
router.patch("/jobs/:id", validate(taSchema.updateJob), updateJob);
router.patch("/jobs/:id/status", validate(taSchema.updateStatus), updateJobStatus);
router.post("/jobs/:jobId/rank-candidates", validate(candidateScoringRouteSchema.rankJob), rankCandidates);
router.get("/jobs/:jobId/ranked-candidates", validate(candidateScoringRouteSchema.rankedCandidates), getRankedCandidates);
router.get("/jobs/:jobId/talent-pool", validate(candidateScoringRouteSchema.talentPool), getTalentPool);
router.get("/candidates/:candidateId/similar", validate(candidateScoringRouteSchema.similarCandidates), getSimilarCandidates);
router.patch("/candidates/:id", validate(taSchema.updateCandidateProfile), updateCandidateProfileHandler);
router.post("/talent-pool/search", validate(candidateScoringRouteSchema.searchTalentPool), searchTalentPool);
router.post("/talent-pool/members", validate(candidateScoringRouteSchema.addCandidate), addCandidateToPool);
router.post("/talent-pool/contacts", validate(candidateScoringRouteSchema.recordContact), recordContact);
router.post("/talent-pool/consider", validate(candidateScoringRouteSchema.considerCandidate), considerCandidateForJob);
router.post("/talent-pool/invitations", validate(talentPoolInvitationRouteSchema.send), sendInvitationHandler);
router.post("/talent-pool/invitations/batch", validate(talentPoolInvitationRouteSchema.batchSend), batchSendInvitationsHandler);
router.get("/talent-pool/invitations", validate(talentPoolInvitationRouteSchema.list), listInvitationsHandler);
router.delete("/talent-pool/invitations/:id", validate(talentPoolInvitationRouteSchema.cancel), cancelInvitationHandler);
router.post("/talent-pool/invitations/expire-overdue", expireOverdueInvitationsHandler);

// Application Pipeline & Recruiter Decisions
router.get("/applications", validate(taSchema.listApplications), listApplications);
router.get("/applications/:id", validate(taSchema.idParams), getApplication);
router.patch("/applications/:id/status", validate(taSchema.updateStatus), updateApplicationStatus);
router.patch("/applications/:id/archive", validate(taSchema.archiveRestore), archiveApplication);
router.patch("/applications/:id/restore", validate(taSchema.archiveRestore), restoreApplication);
router.get("/applications/:id/decisions", validate(taSchema.idParams), getRecruiterDecisionsHandler);
router.post("/applications/:id/contract/sign", validate(taSchema.signContract), signContractHandler);
router.post("/applications/:id/orientation/complete", validate(taSchema.completeOrientation), completeOrientationHandler);

// Client Endorsement
router.post("/applications/:id/endorse", validate(taSchema.endorseCandidate), recordEndorsementHandler);
router.get("/applications/:id/endorsements", validate(taSchema.idParams), listEndorsementsHandler);
router.patch("/applications/:id/endorsements/:endorsementId", validate(taSchema.updateEndorsement), updateEndorsementHandler);

// AI Resume Scoring
router.post("/applications/:id/analyze", validate(taSchema.idParams), analyzeApplication);

// Interview Scheduling & Compliance
router.get("/compliance/interviews", checkInterviewCompliance);
router.get("/applications/:id/interviews", validate(taSchema.idParams), listInterviews);
router.post("/applications/:id/interviews", validate(taSchema.scheduleInterview), scheduleInterview);
router.post("/applications/:id/interviews/record", validate(taSchema.recordInterview), recordInterviewDirectly);
router.patch("/applications/:id/interviews/:interviewId/status", validate(taSchema.updateInterviewStatus), updateInterviewStatus);

// Compliance Checklist
router.post("/applications/:id/compliance", validate(taSchema.createComplianceRequirement), createRequirementHandler);
router.get("/applications/:id/compliance", validate(taSchema.idParams), listRequirementsHandler);
router.post("/compliance/:requirementId/submit", validate(taSchema.submitComplianceDocument), submitDocumentHandler);
router.patch("/compliance/:requirementId/review", validate(taSchema.reviewComplianceRequirement), reviewRequirementHandler);
router.patch("/compliance/:requirementId/deadline", validate(taSchema.updateComplianceDeadline), updateRequirementDeadlineHandler);
router.delete("/compliance/:requirementId", validate(taSchema.deleteComplianceRequirement), deleteRequirementHandler);

// Deployment Lifecycle
router.post("/applications/:id/deploy", validate(taSchema.createDeployment), createDeploymentHandler);
router.post("/applications/:id/fast-track-redeployment", validate(taSchema.fastTrackRedeployment), fastTrackRedeploymentHandler);
router.patch("/deployments/:id/status", validate(taSchema.updateDeploymentStatus), updateDeploymentStatusHandler);
router.post("/deployments/:id/sign-contract", validate(taSchema.signDeploymentContract), signDeploymentContractHandler);
router.patch("/deployments/:id/contract", validate(taSchema.updateDeploymentContract), updateDeploymentContractHandler);
router.get("/deployments", validate(taSchema.listDeployments), listDeploymentsHandler);
router.get("/deployments/:id", validate(taSchema.idParams), getDeploymentDetailsHandler);

// Analytics & Reports
router.get("/analytics/dashboard", validate(analyticsSchema.filters), getTADashboardSummaryHandler);
router.get("/analytics/overview", validate(analyticsSchema.filters), getTAOverviewHandler);
router.get("/analytics/activity", validate(analyticsSchema.filters), getTAActivityTrendHandler);
router.get("/analytics/pipeline-funnel", validate(analyticsSchema.filters), getTAPipelineFunnelHandler);
router.get("/analytics/pending-actions", validate(analyticsSchema.filters), getTAPendingActionsHandler);
router.get("/analytics/filters", validate(analyticsSchema.filters), getTAFilterOptionsHandler);

// Legacy Analytics endpoints (preserved)
router.get("/analytics/pipeline", validate(analyticsSchema.filters), getPipelineStatsHandler);
router.get("/analytics/time-to-fill", validate(analyticsSchema.filters), getTimeToFillStatsHandler);
router.get("/analytics/deployments", validate(analyticsSchema.filters), getDeploymentStatsHandler);
router.get("/analytics/compliance", validate(analyticsSchema.filters), getComplianceOverviewHandler);
router.get("/reports/pipeline", validate(analyticsSchema.report), exportPipelineReportHandler);
router.get("/reports/deployments", validate(analyticsSchema.report), exportDeploymentReportHandler);

// Post-Hire & Vault 201
router.post("/applications/:id/documents", upload.single("file"), validate(taSchema.uploadPostHireDocument), uploadPostHireDocument);

export default router;
