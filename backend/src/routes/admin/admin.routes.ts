import { Router } from "express";
import { authenticateJWT, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { adminSchema } from '../../schemas/admin.schema.js';

import {
  listUsers,
  updateUserRole,
  updateUserStatus,
} from '../../controllers/admin/admin.users.controller.js';

import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
} from '../../controllers/admin/admin.policies.controller.js';

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

const router = Router();

// Enforce authentication and ADMINISTRATOR role
router.use(authenticateJWT);
router.use(requireRole("ADMINISTRATOR"));

// User & Role Management
router.get("/users", listUsers);
router.patch("/users/:id/role", validate(adminSchema.updateUserRole), updateUserRole);
router.patch("/users/:id/status", validate(adminSchema.updateUserStatus), updateUserStatus);

// System Policies & Dynamic Scoring Config
router.get("/policies", listPolicies);
router.post("/policies", validate(adminSchema.createPolicy), createPolicy);
router.patch("/policies/:key", validate(adminSchema.updatePolicy), updatePolicy);
router.delete("/policies/:key", deletePolicy);

router.get("/candidate-scoring/configuration", getConfiguration);
router.post("/candidate-scoring/configuration/validate", validateConfiguration);
router.put("/candidate-scoring/configuration", updateConfiguration);
router.post("/candidate-scoring/configuration/restore-defaults", restoreDefaults);
router.get("/candidate-scoring/configuration/history", getConfigurationHistory);
router.get("/candidate-scoring/revalidation-status", getRevalidationStatus);
router.get("/candidate-scoring/quality-metrics", getQualityMetrics);

// Audit Trail
router.get("/audit-logs", listAuditLogs);

export default router;
