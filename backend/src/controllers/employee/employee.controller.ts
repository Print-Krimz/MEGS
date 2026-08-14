import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { logAudit } from "../../utils/audit.js";
import {
  getDigital201ByEmployeeId,
  getDigital201ByUserId,
  listEmployees,
  getEmployeeById,
  updateEmployeeStatus,
  createEmployeeDeployment,
  endEmployeeDeployment,
  getEmployeeEmploymentHistory,
} from "../../services/employee/employee.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// EMPLOYEE & DIGITAL 201 CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/employees - List employees (e.g. Redeployment Pool or Active directory)
 */
export const listEmployeesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, department, search, limit, offset } = req.query;
    const employees = await listEmployees({
      status: status as any,
      department: department as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    sendSuccess(res, "Employees retrieved successfully", employees);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

/**
 * GET /api/employees/:id - Get basic employee profile
 */
export const getEmployeeHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id as string);
    if (isNaN(employeeId)) {
      sendError(res, "Invalid employee ID", 400);
      return;
    }

    const employee = await getEmployeeById(employeeId);

    // Authorization: TA, Admin, or own record
    if (
      req.user!.role === "APPLICANT" &&
      req.user!.id !== employee.userId
    ) {
      sendError(res, "Forbidden: Unauthorized access to employee record", 403);
      return;
    }

    sendSuccess(res, "Employee retrieved successfully", employee);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

/**
 * GET /api/employees/:id/digital-201 - Aggregate Digital 201 Personnel Record
 */
export const getDigital201Handler = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id as string);
    if (isNaN(employeeId)) {
      sendError(res, "Invalid employee ID", 400);
      return;
    }

    const digital201 = await getDigital201ByEmployeeId(employeeId);

    // Authorization check
    if (
      req.user!.role === "APPLICANT" &&
      req.user!.id !== digital201.employee.userId
    ) {
      sendError(res, "Forbidden: Unauthorized access to Digital 201 personnel record", 403);
      return;
    }

    sendSuccess(res, "Digital 201 record retrieved successfully", digital201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

/**
 * GET /api/employees/me/digital-201 - Self-service Digital 201 for logged in employee
 */
export const getMyDigital201Handler = async (req: Request, res: Response): Promise<void> => {
  try {
    const digital201 = await getDigital201ByUserId(req.user!.id);
    sendSuccess(res, "Personal Digital 201 record retrieved", digital201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};

/**
 * PATCH /api/employees/:id/status - Update employment status
 */
export const updateEmployeeStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id as string);
    if (isNaN(employeeId)) {
      sendError(res, "Invalid employee ID", 400);
      return;
    }

    const { status, reason } = req.body;
    const updated = await updateEmployeeStatus(employeeId, status, req.user!.id, reason);

    logAudit(req.user!.id, "EMPLOYEE_STATUS_UPDATED", "Employee", employeeId, {
      newStatus: status,
      reason,
    });

    sendSuccess(res, `Employee status updated to ${status}`, updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

/**
 * POST /api/employees/:id/deployments - Deploy employee to client/site
 */
export const createEmployeeDeploymentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id as string);
    if (isNaN(employeeId)) {
      sendError(res, "Invalid employee ID", 400);
      return;
    }

    const deployment = await createEmployeeDeployment(req.user!.id, {
      ...req.body,
      employeeId,
    });

    logAudit(req.user!.id, "EMPLOYEE_DEPLOYED", "Deployment", deployment.id, {
      employeeId,
      clientId: req.body.clientId,
      site: req.body.site,
    });

    sendSuccess(res, "Employee deployed successfully", deployment, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found")
      ? 404
      : error.message.includes("already") || error.message.includes("Cannot deploy")
      ? 400
      : 500;
    sendError(res, error.message, statusCode);
  }
};

/**
 * POST /api/deployments/:id/end - End active deployment and update redeployment status
 */
export const endEmployeeDeploymentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const deploymentId = parseInt(req.params.id as string);
    if (isNaN(deploymentId)) {
      sendError(res, "Invalid deployment ID", 400);
      return;
    }

    const { reason, makeAvailableForRedeployment } = req.body;
    const ended = await endEmployeeDeployment(deploymentId, req.user!.id, {
      reason,
      makeAvailableForRedeployment: makeAvailableForRedeployment !== false,
    });

    logAudit(req.user!.id, "DEPLOYMENT_ENDED", "Deployment", deploymentId, {
      reason,
      makeAvailableForRedeployment,
    });

    sendSuccess(res, "Deployment ended successfully", ended);
  } catch (error: any) {
    const statusCode = error.message.includes("not found")
      ? 404
      : error.message.includes("already")
      ? 400
      : 500;
    sendError(res, error.message, statusCode);
  }
};

/**
 * GET /api/employees/:id/employment-history - Get immutable audit trail of employment events
 */
export const getEmployeeEmploymentHistoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const employeeId = parseInt(req.params.id as string);
    if (isNaN(employeeId)) {
      sendError(res, "Invalid employee ID", 400);
      return;
    }

    const employee = await getEmployeeById(employeeId);
    if (req.user!.role === "APPLICANT" && req.user!.id !== employee.userId) {
      sendError(res, "Forbidden: Unauthorized access", 403);
      return;
    }

    const history = await getEmployeeEmploymentHistory(employeeId);
    sendSuccess(res, "Employment history retrieved successfully", history);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 500;
    sendError(res, error.message, statusCode);
  }
};
