import { Router } from "express";
import { getRedeploymentQueueSummaryHandler, listRedeploymentQueueHandler, listRedeploymentSuggestionsHandler, updateRedeploymentFollowUpHandler } from "../../controllers/employee/employee.controller.js";
import { authenticateJWT, requireRole } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { requireOwned, requireOwnedBody } from "../../services/ta/ownership.js";
import { employeeSchema } from "../../schemas/employee.schema.js";
import {
  listEmployeesHandler,
  listEmployeeCredentialAlertsHandler,
  getEmployeeHandler,
  getDigital201Handler,
  getMyDigital201Handler,
  updateEmployeeStatusHandler,
  createEmployeeDeploymentHandler,
  endEmployeeDeploymentHandler,
  getEmployeeEmploymentHistoryHandler,
  updateEmployeeDetailsHandler,
} from "../../controllers/employee/employee.controller.js";

const router = Router();

// All employee routes require authentication
router.use(authenticateJWT);

// Self-service route for logged in employee to view their Digital 201
router.get("/me/digital-201", getMyDigital201Handler);

// End deployment route
router.post(
  "/deployments/:id/end",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.endDeployment),
  requireOwned("deployment"),
  endEmployeeDeploymentHandler
);

// Employee list & filtering (Redeployment Pool vs Active)
router.get("/credential-alerts", requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"), listEmployeeCredentialAlertsHandler);
// Static routes stay above every "/:id" route.
router.get("/redeployment-queue", requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"), validate(employeeSchema.redeploymentQueue), listRedeploymentQueueHandler);
router.get("/redeployment-queue/summary", requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"), validate(employeeSchema.redeploymentSummary), getRedeploymentQueueSummaryHandler);
router.get("/redeployment-queue/suggestions", requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"), validate(employeeSchema.redeploymentSuggestions), listRedeploymentSuggestionsHandler);
router.patch("/:id/redeployment", requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"), validate(employeeSchema.updateRedeployment), requireOwned("employeePool"), updateRedeploymentFollowUpHandler);

router.get(
  "/",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.listEmployees),
  listEmployeesHandler
);

// Individual employee routes with internal ownership & role authorization
router.get("/:id", validate(employeeSchema.idParams), requireOwned("employeePool"), getEmployeeHandler);
router.get("/:id/digital-201", validate(employeeSchema.idParams), requireOwned("employee"), getDigital201Handler);
router.get("/:id/employment-history", validate(employeeSchema.idParams), requireOwned("employeePool"), getEmployeeEmploymentHistoryHandler);

// Admin / TA Mutations
router.patch(
  "/:id/status",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.updateStatus),
  requireOwned("employee"),
  updateEmployeeStatusHandler
);

router.patch(
  "/:id/details",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.updateDetails),
  requireOwned("employee"),
  updateEmployeeDetailsHandler
);

router.post(
  "/:id/deployments",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.createDeployment),
  requireOwned("employeePool"),
  requireOwnedBody("mrf", "mrfId"),
  requireOwnedBody("client", "clientId"),
  createEmployeeDeploymentHandler
);

export default router;
