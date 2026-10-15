import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { reportLimiters, maintenanceLimiters, analyticsLimiters, scoringLimiters } from '../../middleware/rate-limiter.middleware.js';
import { acquireUploadSlot } from '../../middleware/upload.middleware.js';
import { acquireMaintenanceSlot, finishMaintenance } from '../../middleware/maintenance-limit.middleware.js';
import { validate, validateDateRangeQuery } from '../../middleware/validate.middleware.js';
import { adminSchema } from '../../schemas/admin.schema.js';
import { analyticsSchema } from '../../schemas/analytics.schema.js';
import { taSchema } from '../../schemas/ta.schema.js';

import {
  listUsers,
  getAdminUserSummaryHandler,
  updateUserRole,
  updateUserStatus,
  inviteTAHandler,
  resendTAInvitationHandler,
  cancelTAInvitationHandler,
  resetUserMfaHandler,
} from '../../controllers/admin/admin.users.controller.js';

import {
  assignClientHandler,
  assignMrfHandler,
  getAdminApplicationHandler,
  reassignTaRecordsHandler,
} from '../../controllers/admin/admin.assignments.controller.js';
import { expireOverdueInvitationsHandler } from '../../controllers/ta/talent-pool-invitation.ta.controller.js';
import { correctInterviewResultHandler } from '../../controllers/admin/admin.interviews.controller.js';
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
  listRestoresHandler,
  cancelMaintenanceHandler,
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
router.use("/analytics", ...analyticsLimiters);
router.use(["/reports", "/audit-logs/export"], ...reportLimiters);

// User & Role Management
router.get("/users", validate(adminSchema.listUsers), listUsers);
router.get("/users/summary", getAdminUserSummaryHandler);
router.post("/invite-ta", validate(adminSchema.inviteTA), inviteTAHandler);
router.post("/users/:id/resend-invite", validate(adminSchema.userParams), resendTAInvitationHandler);
router.post("/users/:id/cancel-invite", validate(adminSchema.userParams), cancelTAInvitationHandler);
router.patch("/users/:id/role", validate(adminSchema.updateUserRole), updateUserRole);
router.patch("/users/:id/status", validate(adminSchema.updateUserStatus), updateUserStatus);
router.post("/users/:id/reset-mfa", validate(adminSchema.userParams), resetUserMfaHandler);

// Interview result corrections (finalized results are read-only for TA)
router.patch("/interviews/:interviewId/result", validate(adminSchema.correctInterviewResult), correctInterviewResultHandler);

// Dynamic Scoring Config
router.get("/candidate-scoring/configuration", getConfiguration);
router.post("/candidate-scoring/configuration/validate", validateConfiguration);
router.put("/candidate-scoring/configuration", ...scoringLimiters, updateConfiguration);
router.post("/candidate-scoring/configuration/restore-defaults", ...scoringLimiters, restoreDefaults);
router.get("/candidate-scoring/configuration/history", getConfigurationHistory);
router.get("/candidate-scoring/quality-metrics", getQualityMetrics);

// Security Audit Trail & Reporting
router.get("/audit-logs", validate(adminSchema.auditLogs), listAuditLogs);
router.get("/audit-logs/export", validate(adminSchema.auditExport), exportAuditReportHandler);

import multer from "multer";

const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fields: 20, fieldSize: 65536, parts: 21 },
});

// Database Maintenance & Encrypted Backups / Restores
router.get("/maintenance/backups", validate(adminSchema.backupList), listBackupsHandler);
router.post("/maintenance/backup", ...maintenanceLimiters, validate(adminSchema.triggerBackup), acquireMaintenanceSlot, finishMaintenance(triggerBackupHandler));
router.patch("/maintenance/backups/:id/rename", validate(adminSchema.renameBackup), renameBackupHandler);
router.get("/maintenance/backups/:id/download", ...reportLimiters, validate(adminSchema.backupIdParams), downloadBackupHandler);
router.post("/maintenance/backups/:id/restore", ...maintenanceLimiters, validate(adminSchema.backupIdParams), acquireMaintenanceSlot, finishMaintenance(restoreDatabaseBackupHandler));
router.get("/maintenance/restores", validate(adminSchema.backupList), listRestoresHandler);
router.post("/maintenance/backups/restore-upload", ...maintenanceLimiters, acquireMaintenanceSlot, acquireUploadSlot, backupUpload.single("file"), validate(adminSchema.restoreUploadedBackup), finishMaintenance(restoreUploadedBackupHandler));
router.post("/maintenance/cancel", cancelMaintenanceHandler);

// Recruitment Analytics
router.get("/analytics/dashboard", validate(analyticsSchema.filters), getAdminDashboardSummaryHandler);
router.get("/analytics/filters", validate(analyticsSchema.filters), getAdminFilterOptionsHandler);

// Global worker: expires overdue talent pool invitations
router.post("/talent-pool/invitations/expire-overdue", expireOverdueInvitationsHandler);

// Manpower Requests Oversight (Read-Only)
router.get("/mrfs", validate(taSchema.listMRFs), listMRFsHandler);
router.get("/mrfs/:id", validate(adminSchema.mrfIdParams), getMRFDetailsHandler);

// Ownership: Admin reassigns requisitions, clients and a departing TA's records
router.patch("/mrfs/:id/assignment", validate(adminSchema.assignment), assignMrfHandler);
router.patch("/clients/:id/assignment", validate(adminSchema.assignment), assignClientHandler);
router.post("/users/:id/reassign-records", validate(adminSchema.reassignRecords), reassignTaRecordsHandler);

// Application detail for oversight links (read-only)
router.get("/applications/:id", validate(adminSchema.idParams), getAdminApplicationHandler);

// Analytics Reports Export
router.get("/reports/pipeline", validate(analyticsSchema.report), exportAdminPipelineReportHandler);
router.get("/reports/deployments", validate(analyticsSchema.report), exportAdminDeploymentReportHandler);

export default router;

