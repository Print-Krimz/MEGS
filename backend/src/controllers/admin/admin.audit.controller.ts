import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { fetchAuditLogs } from '../../services/admin/admin.service.js';

// GET /api/admin/audit-logs - Query audit trail with optional action/user/entity filters
export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, userId, entity, limit } = req.query;
    const logs = await fetchAuditLogs({
      action: action as string,
      userId: userId as string,
      entity: entity as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    sendSuccess(res, "Audit logs retrieved successfully", logs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
