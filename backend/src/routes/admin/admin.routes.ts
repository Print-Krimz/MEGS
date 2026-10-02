import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { validate, validateDateRangeQuery } from '../../middleware/validate.middleware.js';
import { adminSchema } from '../../schemas/admin.schema.js';
import { analyticsSchema } from '../../schemas/analytics.schema.js';
import { taSchema } from '../../schemas/ta.schema.js';

import {
  listUsers,
  updateUserRole,
  updateUserStatus,
  inviteTAHandler,
  resendTAInvitationHandler,
  cancelTAInvitationHandler,
  resetUserMfaHandler,
} from '../../controllers/admin/admin.users.controller.js';

import {
  listAuditLogs,
  exportAuditReportHandler,
} from '../../controllers/admin/admin.audit.controller.js';
import {
  listBackupsHandler,
  triggerBackupHandler,
  renameBackupHandler,
  downloadBackupHandler,
  restoreDatabaseBackupHandler,
  restoreUploadedBackupHandler,
} from '../../controllers/admin/admin.maintenance.controller.js';
import {
  getConfiguration,
  getConfigurationHistory,
  getQualityMetrics,
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
  getAdminDashboardSummaryHandler,
  exportAdminPipelineReportHandler,
  exportAdminDeploymentReportHandler,
} from '../../controllers/admin/admin.analytics.controller.js';
import {
  listMRFsHandler,
  getMRFDetailsHandler,
} from '../../controllers/ta/ta.mrf.controller.js';

const router = Router();

// Enforce authentication and ADMINISTRATOR role
router.use(authenticateJWT);
router.use(requireRole("ADMINISTRATOR"));
router.use(validateDateRangeQuery);

// User & Role Management
router.get("/users", validate(adminSchema.listUsers), listUsers);
router.post("/invite-ta", validate(adminSchema.inviteTA), inviteTAHandler);
router.post("/users/:id/resend-invite", validate(adminSchema.userParams), resendTAInvitationHandler);
router.post("/users/:id/cancel-invite", validate(adminSchema.userParams), cancelTAInvitationHandler);
router.patch("/users/:id/role", validate(adminSchema.updateUserRole), updateUserRole);
router.patch("/users/:id/status", validate(adminSchema.updateUserStatus), updateUserStatus);
router.post("/users/:id/reset-mfa", validate(adminSchema.userParams), resetUserMfaHandler);

// Dynamic Scoring Config
router.get("/candidate-scoring/configuration", getConfiguration);
router.post("/candidate-scoring/configuration/validate", validateConfiguration);
router.put("/candidate-scoring/configuration", updateConfiguration);
router.post("/candidate-scoring/configuration/restore-defaults", restoreDefaults);
router.get("/candidate-scoring/configuration/history", getConfigurationHistory);
router.get("/candidate-scoring/quality-metrics", getQualityMetrics);

// Security Audit Trail & Reporting
router.get("/audit-logs", validate(adminSchema.auditLogs), listAuditLogs);
router.get("/audit-logs/export", validate(adminSchema.auditExport), exportAuditReportHandler);

import multer from "multer";

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Database Maintenance & Encrypted Backups / Restores
router.get("/maintenance/backups", validate(adminSchema.backupList), listBackupsHandler);
router.post("/maintenance/backup", validate(adminSchema.triggerBackup), triggerBackupHandler);
router.patch("/maintenance/backups/:id/rename", validate(adminSchema.renameBackup), renameBackupHandler);
router.get("/maintenance/backups/:id/download", validate(adminSchema.backupIdParams), downloadBackupHandler);
router.post("/maintenance/backups/:id/restore", validate(adminSchema.backupIdParams), restoreDatabaseBackupHandler);
router.post("/maintenance/backups/restore-upload", backupUpload.single("file"), validate(adminSchema.restoreUploadedBackup), restoreUploadedBackupHandler);

// Recruitment Analytics
router.get("/analytics/dashboard", validate(analyticsSchema.filters), getAdminDashboardSummaryHandler);
router.get("/analytics/overview", validate(analyticsSchema.filters), getAdminOverviewHandler);
router.get("/analytics/activity", validate(analyticsSchema.filters), getAdminActivityTrendHandler);
router.get("/analytics/funnel", validate(analyticsSchema.filters), getAdminFunnelHandler);
router.get("/analytics/bottlenecks", validate(analyticsSchema.filters), getAdminBottlenecksHandler);
router.get("/analytics/jobs", validate(analyticsSchema.filters), getAdminJobDemandsHandler);
router.get("/analytics/filters", validate(analyticsSchema.filters), getAdminFilterOptionsHandler);

// Manpower Requests Oversight (Read-Only)
router.get("/mrfs", validate(taSchema.listMRFs), listMRFsHandler);
router.get("/mrfs/:id", validate(adminSchema.mrfIdParams), getMRFDetailsHandler);

// Analytics Reports Export
router.get("/reports/pipeline", validate(analyticsSchema.report), exportAdminPipelineReportHandler);
router.get("/reports/deployments", validate(analyticsSchema.report), exportAdminDeploymentReportHandler);

export default router;

