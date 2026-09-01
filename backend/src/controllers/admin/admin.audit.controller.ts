import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { fetchAuditLogs } from '../../services/admin/admin.service.js';
import {
  generateAuditReportPDF,
  generateAuditReportCSV,
} from "../../services/admin/audit-export.service.js";

// GET /api/admin/audit-logs - Query audit trail with optional action/user/entity filters
export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, userId, entity, category, search, startDate, endDate, limit } = req.query;
    const logs = await fetchAuditLogs({
      action: action as string,
      userId: userId as string,
      entity: entity as string,
      category: category as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    sendSuccess(res, "Audit logs retrieved successfully", logs);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// GET /api/admin/audit-logs/export - Export filtered audit logs as PDF or CSV
export const exportAuditReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { format = "pdf", action, userId, entity, category, search, startDate, endDate } = req.query;
    const filters = {
      action: action as string,
      userId: userId as string,
      entity: entity as string,
      category: category as string,
      search: search as string,
      startDate: startDate as string,
      endDate: endDate as string,
    };

    const timestamp = new Date().toISOString().slice(0, 10);

    if (String(format).toLowerCase() === "csv") {
      const csvBuffer = await generateAuditReportCSV(
        { id: user?.id || "system", email: user?.email || "admin@megs.system" },
        filters
      );
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="megs-security-audit-${timestamp}.csv"`
      );
      res.send(csvBuffer);
      return;
    }

    const pdfBuffer = await generateAuditReportPDF(
      { id: user?.id || "system", email: user?.email || "admin@megs.system" },
      filters
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="megs-security-audit-${timestamp}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to export audit report" });
  }
};

