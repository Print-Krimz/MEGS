import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  getPipelineStats,
  getTimeToFillStats,
  getDeploymentStats,
  getComplianceOverview,
} from "../../services/analytics/analytics.service.js";
import {
  generatePipelineReportPDF,
  generatePipelineReportXLSX,
  generateDeploymentReportPDF,
  generateDeploymentReportXLSX,
} from "../../services/analytics/export.service.js";

export const getPipelineStatsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getPipelineStats();
    sendSuccess(res, "Pipeline statistics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getTimeToFillStatsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const mrfId = req.query.mrfId ? parseInt(req.query.mrfId as string, 10) : undefined;
    const stats = await getTimeToFillStats(mrfId);
    sendSuccess(res, "Time-to-fill statistics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getDeploymentStatsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const stats = await getDeploymentStats(clientId);
    sendSuccess(res, "Deployment statistics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getComplianceOverviewHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getComplianceOverview();
    sendSuccess(res, "Compliance overview retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportPipelineReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string || "pdf").toLowerCase();
    const user = req.user!;

    if (format === "xlsx") {
      const buffer = await generatePipelineReportXLSX(user);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="pipeline-report-${Date.now()}.xlsx"`);
      res.send(buffer);
    } else {
      const buffer = await generatePipelineReportPDF(user);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="pipeline-report-${Date.now()}.pdf"`);
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportDeploymentReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string || "pdf").toLowerCase();
    const user = req.user!;

    if (format === "xlsx") {
      const buffer = await generateDeploymentReportXLSX(user);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="deployment-report-${Date.now()}.xlsx"`);
      res.send(buffer);
    } else {
      const buffer = await generateDeploymentReportPDF(user);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="deployment-report-${Date.now()}.pdf"`);
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
