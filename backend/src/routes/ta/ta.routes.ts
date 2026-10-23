import { Router } from "express";
import { taComplianceBulkSchema, BULK_UPLOAD_MAX_FILES } from "../../schemas/ta-compliance-bulk.schema.js";
import { requestDocumentUpdateHandler, uploadComplianceDocumentForApplicantHandler, bulkUploadComplianceDocumentsHandler } from "../../controllers/ta/ta.compliance.controller.js";
import { aiLimiters, reportLimiters, analyticsLimiters } from '../../middleware/rate-limiter.middleware.js';
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { upload, uploadContractScan } from '../../middleware/upload.middleware.js';
import { validate, validateDateRangeQuery } from '../../middleware/validate.middleware.js';
import { taSchema } from '../../schemas/ta.schema.js';
import { analyticsSchema } from '../../schemas/analytics.schema.js';
import { candidateScoringRouteSchema } from '../../schemas/candidate-scoring.schema.js';
import { talentPoolInvitationRouteSchema } from '../../schemas/talent-pool-invitation.schema.js';
import { getTADashboardCountsHandler } from '../../controllers/ta/ta.dashboard.controller.js';

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
  recordBackoutHandler,
  closeApplicationHandler,
  archiveApplication,
  restoreApplication,
  getRecruiterDecisionsHandler,
  downloadContractPdfHandler,
  uploadSignedContractHandler,
  updateCandidateProfileHandler,
} from '../../controllers/ta/ta.applications.controller.js';
import { getCandidateResumeProposalHandler, applyCandidateResumeMergeHandler } from '../../controllers/ta/ta.resume.controller.js';

import { analyzeApplication, getAnalysisStatus } from '../../controllers/ta/ta.ai.controller.js';

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
  getScopedApplicationsHandler,
} from '../../controllers/ta/ta.compliance.controller.js';

import {
  createDeploymentHandler,
  updateDeploymentStatusHandler,
  listDeploymentsHandler,
  getDeploymentDetailsHandler,
  signDeploymentContractHandler,
  updateDeploymentContractHandler,
  recordDeploymentReviewHandler,
  fastTrackRedeploymentHandler,
} from '../../controllers/ta/ta.deployments.controller.js';

import {
  getPipelineStatsHandler,
  getComplianceOverviewHandler,
  exportPipelineReportHandler,
  exportDeploymentReportHandler,
  getTAPendingActionsHandler,
  getTAFilterOptionsHandler,
  getTADashboardSummaryHandler,
} from '../../controllers/ta/ta.analytics.controller.js';
import { requireOwned, requireOwnedBody } from "../../services/ta/ownership.js";
import {
  checkWalkInDuplicateHandler,
  createWalkInHandler,
  reissueWalkInSlipHandler,
} from '../../controllers/ta/ta.walk-in.controller.js';
import { offerReplyRouteSchema } from "../../schemas/offer-reply.schema.js";
import { checkInSchema } from "../../schemas/check-in.schema.js";
import {
  confirmCheckInHandler,
  dismissCheckInHandler,
  getCheckInHandler,
  getCheckInBiodataHandler,
  listCheckInsHandler,
} from "../../controllers/ta/ta.check-in.controller.js";
import { recordAssistedResponseHandler, sendOfferSmsLinkHandler } from "../../controllers/ta/ta.offer-reply.controller.js";

const router = Router();

router.use(authenticateJWT);
router.use(requireRole("TALENT_ACQUISITION"));
router.use(validateDateRangeQuery);
router.use("/analytics", ...analyticsLimiters);
router.use("/reports", ...reportLimiters);
router.use(["/talent-pool/search", "/candidates/:candidateId/similar", "/jobs/:jobId/talent-pool", "/jobs/:jobId/rank-candidates"], ...aiLimiters);

router.get("/dashboard-counts", getTADashboardCountsHandler);

// Client & MRF Management
router.get("/clients", validate(taSchema.listClients), listClientsHandler);
router.post("/clients", validate(taSchema.createClient), createClientHandler);
router.get("/clients/:id", validate(taSchema.idParams), requireOwned("client"), getClientDetailsHandler);
router.patch("/clients/:id", validate(taSchema.updateClient), requireOwned("client"), updateClientHandler);

router.get("/mrfs", validate(taSchema.listMRFs), listMRFsHandler);
router.post("/mrfs", validate(taSchema.createMRF), createMRFHandler);
router.get("/mrfs/:id", validate(taSchema.idParams), requireOwned("mrf"), getMRFDetailsHandler);
router.patch("/mrfs/:id", validate(taSchema.updateMRF), requireOwned("mrf"), updateMRFHandler);
router.post("/mrfs/:id/link-job", validate(taSchema.linkJobToMRF), requireOwned("mrf"), linkJobToMRFHandler);
router.post("/mrfs/:id/compliance-templates/bulk", validate(taSchema.createComplianceTemplatesBulk), requireOwned("mrf"), addMRFComplianceTemplatesBulkHandler);
router.post("/mrfs/:id/compliance-templates", validate(taSchema.createComplianceTemplate), requireOwned("mrf"), addMRFComplianceTemplateHandler);
router.get("/mrfs/:id/compliance-templates", validate(taSchema.idParams), requireOwned("mrf"), listMRFComplianceTemplatesHandler);
router.delete("/mrfs/compliance-templates/:templateId", validate(taSchema.deleteMrfComplianceTemplate), requireOwned("template", "templateId"), removeMRFComplianceTemplateHandler);

// Job Postings & Candidate Scoring
router.get("/jobs", validate(taSchema.listJobs), listJobs);
router.post("/jobs", validate(taSchema.createJob), createJob);
router.get("/jobs/:id", validate(taSchema.idParams), requireOwned("job"), getJob);
router.patch("/jobs/:id", validate(taSchema.updateJob), requireOwned("job"), updateJob);
router.patch("/jobs/:id/status", validate(taSchema.updateStatus), requireOwned("job"), updateJobStatus);
router.post("/jobs/:jobId/rank-candidates", validate(candidateScoringRouteSchema.rankJob), requireOwned("job", "jobId"), rankCandidates);
router.get("/jobs/:jobId/ranked-candidates", validate(candidateScoringRouteSchema.rankedCandidates), requireOwned("job", "jobId"), getRankedCandidates);
router.get("/jobs/:jobId/talent-pool", validate(candidateScoringRouteSchema.talentPool), requireOwned("job", "jobId"), getTalentPool);
// candidateId is an application id; the TA must own that application.
router.get("/candidates/:candidateId/similar", validate(candidateScoringRouteSchema.similarCandidates), requireOwned("application", "candidateId"), getSimilarCandidates);
router.patch("/candidates/:id", validate(taSchema.updateCandidateProfile), requireOwned("candidate"), updateCandidateProfileHandler);
router.get("/candidates/:id/resume-proposal", validate(taSchema.candidateResumeProposal), requireOwned("candidate"), getCandidateResumeProposalHandler);
router.post("/candidates/:id/resume-merge/:parseId/apply", validate(taSchema.applyCandidateResumeMerge), requireOwned("candidate"), applyCandidateResumeMergeHandler);
router.post("/talent-pool/search", validate(candidateScoringRouteSchema.searchTalentPool), requireOwnedBody("job", "jobId"), requireOwnedBody("application", "candidateId"), searchTalentPool);
router.post("/talent-pool/members", validate(candidateScoringRouteSchema.addCandidate), addCandidateToPool);
router.post("/talent-pool/contacts", validate(candidateScoringRouteSchema.recordContact), requireOwnedBody("job", "jobPostingId"), recordContact);
router.post("/talent-pool/consider", validate(candidateScoringRouteSchema.considerCandidate), requireOwnedBody("job", "targetJobId"), considerCandidateForJob);
router.post("/talent-pool/invitations", validate(talentPoolInvitationRouteSchema.send), requireOwnedBody("job", "targetJobId"), sendInvitationHandler);
router.post("/talent-pool/invitations/batch", validate(talentPoolInvitationRouteSchema.batchSend), requireOwnedBody("job", "targetJobId"), batchSendInvitationsHandler);
router.get("/talent-pool/invitations", validate(talentPoolInvitationRouteSchema.list), listInvitationsHandler);
router.delete("/talent-pool/invitations/:id", validate(talentPoolInvitationRouteSchema.cancel), cancelInvitationHandler);
// Offer replies for applicants without a portal login.
router.post("/talent-pool/invitations/:id/assisted-response", validate(offerReplyRouteSchema.assistedResponse), requireOwned("invitation"), recordAssistedResponseHandler);
router.post("/talent-pool/invitations/:id/sms-link", validate(offerReplyRouteSchema.smsLink), requireOwned("invitation"), sendOfferSmsLinkHandler);

// Walk-in intake (staff-encoded applicants and their printed QR slip).
// POST /walk-ins checks job ownership inside createWalkIn (the job id arrives in a multipart body).
// Self check-ins from the MEGS poster QR. Shared on purpose: any TA at the desk may confirm or
// dismiss a pending one; once confirmed, the application belongs to the job's owner.
router.get("/walk-ins/check-ins", listCheckInsHandler);
router.get("/walk-ins/check-ins/:id", validate(checkInSchema.idParams), getCheckInHandler);
router.get("/walk-ins/check-ins/:id/biodata", validate(checkInSchema.idParams), getCheckInBiodataHandler);
router.post("/walk-ins/check-ins/:id/confirm", upload.single("file"), validate(checkInSchema.confirm), confirmCheckInHandler);
router.post("/walk-ins/check-ins/:id/dismiss", validate(checkInSchema.dismiss), dismissCheckInHandler);
router.get("/walk-ins/check-duplicate", validate(taSchema.walkInCheckDuplicate), checkWalkInDuplicateHandler);
router.post("/walk-ins", upload.single("file"), validate(taSchema.createWalkIn), createWalkInHandler);
router.post("/walk-ins/:id/slip", validate(taSchema.walkInSlip), requireOwned("application"), reissueWalkInSlipHandler);

// Application Pipeline & Recruiter Decisions
router.get("/applications", validate(taSchema.listApplications), listApplications);
router.get("/applications/:id", validate(taSchema.idParams), requireOwned("application"), getApplication);
router.patch("/applications/:id/status", validate(taSchema.updateApplicationStatus), requireOwned("application"), updateApplicationStatus);
router.post("/applications/:id/backout", validate(taSchema.recordBackout), requireOwned("application"), recordBackoutHandler);
router.post("/applications/:id/close", validate(taSchema.closeApplication), requireOwned("application"), closeApplicationHandler);
router.patch("/applications/:id/archive", validate(taSchema.archiveRestore), requireOwned("application"), archiveApplication);
router.patch("/applications/:id/restore", validate(taSchema.archiveRestore), requireOwned("application"), restoreApplication);
router.get("/applications/:id/decisions", validate(taSchema.idParams), requireOwned("application"), getRecruiterDecisionsHandler);
router.get("/applications/:id/contract/pdf", validate(taSchema.downloadContractPdf), requireOwned("application"), downloadContractPdfHandler);
router.post("/applications/:id/contract/signed", uploadContractScan.single("file"), validate(taSchema.uploadSignedContract), requireOwned("application"), uploadSignedContractHandler);

// Client Endorsement
router.post("/applications/:id/endorse", validate(taSchema.endorseCandidate), requireOwned("application"), recordEndorsementHandler);
router.get("/applications/:id/endorsements", validate(taSchema.idParams), requireOwned("application"), listEndorsementsHandler);
router.patch("/applications/:id/endorsements/:endorsementId", validate(taSchema.updateEndorsement), requireOwned("application"), requireOwned("endorsement", "endorsementId"), updateEndorsementHandler);

// AI Resume Scoring
router.post("/applications/:id/analyze", validate(taSchema.idParams), requireOwned("application"), analyzeApplication);
router.get("/applications/:id/analyze/status", validate(taSchema.idParams), requireOwned("application"), getAnalysisStatus);

// Interview Scheduling & Compliance
router.get("/compliance/interviews", validate(taSchema.listInterviewCompliance), checkInterviewCompliance);
router.get("/applications/:id/interviews", validate(taSchema.idParams), requireOwned("application"), listInterviews);
router.post("/applications/:id/interviews", validate(taSchema.scheduleInterview), requireOwned("application"), scheduleInterview);
router.post("/applications/:id/interviews/record", validate(taSchema.recordInterview), requireOwned("application"), recordInterviewDirectly);
router.patch("/applications/:id/interviews/:interviewId/status", validate(taSchema.updateInterviewStatus), requireOwned("application"), requireOwned("interview", "interviewId"), updateInterviewStatus);

// Compliance Checklist
router.get("/compliance/queue", validate(taSchema.complianceQueueQuery), getScopedApplicationsHandler);
router.post("/applications/:id/compliance", validate(taSchema.createComplianceRequirement), requireOwned("application"), createRequirementHandler);
router.get("/applications/:id/compliance", validate(taSchema.idParams), requireOwned("application"), listRequirementsHandler);
router.post("/applications/:id/compliance/bulk-upload", upload.array("files", BULK_UPLOAD_MAX_FILES), validate(taComplianceBulkSchema.bulkUpload), requireOwned("application"), bulkUploadComplianceDocumentsHandler);
router.post("/compliance/:requirementId/upload", upload.single("file"), validate(taSchema.uploadComplianceDocument), requireOwned("requirement", "requirementId"), uploadComplianceDocumentForApplicantHandler);
router.post("/compliance/:requirementId/submit", validate(taSchema.submitComplianceDocument), requireOwned("requirement", "requirementId"), submitDocumentHandler);
router.patch("/compliance/:requirementId/review", validate(taSchema.reviewComplianceRequirement), requireOwned("requirement", "requirementId"), reviewRequirementHandler);
router.post("/compliance/:requirementId/update-request", validate(taSchema.requestDocumentUpdate), requireOwned("requirement", "requirementId"), requestDocumentUpdateHandler);
router.patch("/compliance/:requirementId/deadline", validate(taSchema.updateComplianceDeadline), requireOwned("requirement", "requirementId"), updateRequirementDeadlineHandler);
router.delete("/compliance/:requirementId", validate(taSchema.deleteComplianceRequirement), requireOwned("requirement", "requirementId"), deleteRequirementHandler);

// Deployment Lifecycle
router.post("/applications/:id/deploy", validate(taSchema.createDeployment), requireOwned("application"), createDeploymentHandler);
router.post("/applications/:id/fast-track-redeployment", validate(taSchema.fastTrackRedeployment), requireOwned("application"), fastTrackRedeploymentHandler);
router.patch("/deployments/:id/status", validate(taSchema.updateDeploymentStatus), requireOwned("deployment"), updateDeploymentStatusHandler);
router.post("/deployments/:id/sign-contract", validate(taSchema.signDeploymentContract), requireOwned("deployment"), signDeploymentContractHandler);
router.patch("/deployments/:id/contract", validate(taSchema.updateDeploymentContract), requireOwned("deployment"), updateDeploymentContractHandler);
router.post("/deployments/:id/reviews", validate(taSchema.recordDeploymentReview), requireOwned("deployment"), recordDeploymentReviewHandler);
router.get("/deployments", validate(taSchema.listDeployments), listDeploymentsHandler);
router.get("/deployments/:id", validate(taSchema.idParams), requireOwned("deployment"), getDeploymentDetailsHandler);

// Analytics & Reports
router.get("/analytics/dashboard", validate(analyticsSchema.filters), getTADashboardSummaryHandler);
router.get("/analytics/pending-actions", validate(analyticsSchema.filters), getTAPendingActionsHandler);
router.get("/analytics/filters", validate(analyticsSchema.filters), getTAFilterOptionsHandler);

// Legacy Analytics endpoints (preserved)
router.get("/analytics/pipeline", validate(analyticsSchema.filters), getPipelineStatsHandler);
router.get("/analytics/compliance", validate(analyticsSchema.filters), getComplianceOverviewHandler);
router.get("/reports/pipeline", validate(analyticsSchema.report), exportPipelineReportHandler);
router.get("/reports/deployments", validate(analyticsSchema.report), exportDeploymentReportHandler);

// Post-Hire & Vault 201
router.post("/applications/:id/documents", upload.single("file"), validate(taSchema.uploadPostHireDocument), requireOwned("application"), uploadPostHireDocument);

export default router;
