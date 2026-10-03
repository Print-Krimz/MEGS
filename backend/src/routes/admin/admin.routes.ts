import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { reportLimiters, maintenanceLimiters, analyticsLimiters, scoringLimiters } from '../../middleware/rate-limiter.middleware.js';
import { acquireUploadSlot } from '../../middleware/upload.middleware.js';
import { acquireMaintenanceSlot, finishMaintenance } from '../../middleware/maintenance-limit.middleware.js';
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
router.use("/analytics", ...analyticsLimiters);
router.use(["/reports", "/audit-logs/export"], ...reportLimiters);

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
router.put("/candidate-scoring/configuration", ...scoringLimiters, updateConfiguration);
router.post("/candidate-scoring/configuration/restore-defaults", ...scoringLimiters, restoreDefaults);
router.get("/candidate-scoring/configuration/history", getConfigurationHistory);
router.get("/candidate-scoring/quality-metrics", getQualityMetrics);

// Security Audit Trail & Reporting
router.get("/audit-logs", listAuditLogs);
router.get("/audit-logs/export", exportAuditReportHandler);

import multer from "multer";

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 20, fieldSize: 65536, parts: 21 },
});

// Database Maintenance & Encrypted Backups / Restores
router.get("/maintenance/backups", listBackupsHandler);
router.post("/maintenance/backup", ...maintenanceLimiters, acquireMaintenanceSlot, finishMaintenance(triggerBackupHandler));
router.patch("/maintenance/backups/:id/rename", renameBackupHandler);
router.get("/maintenance/backups/:id/download", ...reportLimiters, downloadBackupHandler);
router.post("/maintenance/backups/:id/restore", ...maintenanceLimiters, acquireMaintenanceSlot, finishMaintenance(restoreDatabaseBackupHandler));
router.post("/maintenance/backups/restore-upload", ...maintenanceLimiters, acquireMaintenanceSlot, acquireUploadSlot, backupUpload.single("file"), finishMaintenance(restoreUploadedBackupHandler));

// Recruitment Analytics
router.get("/analytics/dashboard", getAdminDashboardSummaryHandler);
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
router.get("/reports/pipeline", exportAdminPipelineReportHandler);
router.get("/reports/deployments", exportAdminDeploymentReportHandler);

export default router;

