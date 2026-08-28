import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { adminSchema } from '../../schemas/admin.schema.js';

import {
  listUsers,
  updateUserRole,
  updateUserStatus,
  inviteTAHandler,
  resendTAInvitationHandler,
  cancelTAInvitationHandler,
  resetUserMfaHandler,
} from '../../controllers/admin/admin.users.controller.js';

import { listAuditLogs } from '../../controllers/admin/admin.audit.controller.js';
import {
  getConfiguration,
  getConfigurationHistory,
  getQualityMetrics,
  getRevalidationStatus,
  restoreDefaults,
  updateConfiguration,
  validateConfiguration,
} from '../../controllers/admin/candidate-scoring.admin.controller.js';

import {
  getAdminOverviewHandler,
  getAdminActivityTrendHandler,
  getAdminFunnelHandler,
  getAdminBottlenecksHandler,
  getAdminJobDemandsHandler,
  getAdminFilterOptionsHandler,
} from '../../controllers/admin/admin.analytics.controller.js';
import {
  listMRFsHandler,
  getMRFDetailsHandler,
} from '../../controllers/ta/ta.mrf.controller.js';
import {
  exportPipelineReportHandler,
  exportDeploymentReportHandler,
} from '../../controllers/ta/ta.analytics.controller.js';

const router = Router();

// Enforce authentication and ADMINISTRATOR role
router.use(authenticateJWT);
router.use(requireRole("ADMINISTRATOR"));

// User & Role Management
router.get("/users", listUsers);
router.post("/invite-ta", validate(adminSchema.inviteTA), inviteTAHandler);
router.post("/users/:id/resend-invite", resendTAInvitationHandler);
router.post("/users/:id/cancel-invite", cancelTAInvitationHandler);
router.patch("/users/:id/role", validate(adminSchema.updateUserRole), updateUserRole);
router.patch("/users/:id/status", validate(adminSchema.updateUserStatus), updateUserStatus);
router.post("/users/:id/reset-mfa", resetUserMfaHandler);

// Dynamic Scoring Config
router.get("/candidate-scoring/configuration", getConfiguration);
router.post("/candidate-scoring/configuration/validate", validateConfiguration);
router.put("/candidate-scoring/configuration", updateConfiguration);
router.post("/candidate-scoring/configuration/restore-defaults", restoreDefaults);
router.get("/candidate-scoring/configuration/history", getConfigurationHistory);
router.get("/candidate-scoring/revalidation-status", getRevalidationStatus);
router.get("/candidate-scoring/quality-metrics", getQualityMetrics);

// Security Audit Trail
router.get("/audit-logs", listAuditLogs);

// Recruitment Analytics
router.get("/analytics/overview", getAdminOverviewHandler);
router.get("/analytics/activity", getAdminActivityTrendHandler);
router.get("/analytics/funnel", getAdminFunnelHandler);
router.get("/analytics/bottlenecks", getAdminBottlenecksHandler);
router.get("/analytics/jobs", getAdminJobDemandsHandler);
router.get("/analytics/filters", getAdminFilterOptionsHandler);

// Manpower Requests Oversight (Read-Only)
router.get("/mrfs", listMRFsHandler);
router.get("/mrfs/:id", getMRFDetailsHandler);

// Analytics Reports Export
router.get("/reports/pipeline", exportPipelineReportHandler);
router.get("/reports/deployments", exportDeploymentReportHandler);

export default router;

