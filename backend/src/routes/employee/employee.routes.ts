import { Router } from "express";
import { authenticateJWT, requireRole } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { employeeSchema } from "../../schemas/employee.schema.js";
import {
  listEmployeesHandler,
  getEmployeeHandler,
  getDigital201Handler,
  getMyDigital201Handler,
  updateEmployeeStatusHandler,
  createEmployeeDeploymentHandler,
  endEmployeeDeploymentHandler,
  getEmployeeEmploymentHistoryHandler,
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
  endEmployeeDeploymentHandler
);

// Employee list & filtering (Redeployment Pool vs Active)
router.get(
  "/",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.listEmployees),
  listEmployeesHandler
);

// Individual employee routes with internal ownership & role authorization
router.get("/:id", getEmployeeHandler);
router.get("/:id/digital-201", getDigital201Handler);
router.get("/:id/employment-history", getEmployeeEmploymentHistoryHandler);

// Admin / TA Mutations
router.patch(
  "/:id/status",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.updateStatus),
  updateEmployeeStatusHandler
);

router.post(
  "/:id/deployments",
  requireRole("TALENT_ACQUISITION", "ADMINISTRATOR"),
  validate(employeeSchema.createDeployment),
  createEmployeeDeploymentHandler
);

export default router;
