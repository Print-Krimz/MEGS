import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import {
  getPipelineStats,
  getComplianceOverview,
  getTAPendingActions,
  countTAPendingActions,
  getAnalyticsFilterOptions,
  AnalyticsFilterDto,
} from "../../services/analytics/analytics.service.js";
import { getTADelivery } from "../../services/analytics/delivery.service.js";
import {
  generatePipelineReportPDF,
  generatePipelineReportXLSX,
  generateDeploymentReportPDF,
  generateDeploymentReportXLSX,
} from "../../services/analytics/export.service.js";

export function extractTAFilters(query: any): AnalyticsFilterDto {
  return {
    range: query.range as any,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    clientId: query.clientId ? parseInt(query.clientId as string, 10) : undefined,
    mrfId: query.mrfId ? parseInt(query.mrfId as string, 10) : undefined,
    jobPostingId: query.jobPostingId ? parseInt(query.jobPostingId as string, 10) : undefined,
    stage: query.stage as string,
    // No recruiterId or mineOnly: a TA's numbers are always their own, enforced by the services.
  };
}

export const getTAPendingActionsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractTAFilters(req.query);
    const actions = await getTAPendingActions(req.user!.id, filters);
    sendSuccess(res, "TA pending action items retrieved", actions);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getTAFilterOptionsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const options = await getAnalyticsFilterOptions("TALENT_ACQUISITION", req.user!.id);
    sendSuccess(res, "TA analytics filter options retrieved", options);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getTADashboardSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractTAFilters(req.query);
    const scope = { role: req.user!.role, userId: req.user!.id };
    const [delivery, pendingActions, pendingActionsTotal, filterOptions] = await Promise.all([
      getTADelivery(filters, scope),
      getTAPendingActions(req.user!.id, filters),
      countTAPendingActions(req.user!.id, filters),
      getAnalyticsFilterOptions("TALENT_ACQUISITION", req.user!.id),
    ]);

    sendSuccess(res, "TA analytics dashboard retrieved", { ...delivery, pendingActions, pendingActionsTotal, filterOptions });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getPipelineStatsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getPipelineStats(req.user);
    sendSuccess(res, "Pipeline statistics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getComplianceOverviewHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const stage = req.query.stage as string | undefined;
    const stats = await getComplianceOverview(stage ? [stage] : undefined, req.user);
    sendSuccess(res, "Compliance overview retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportPipelineReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string || "pdf").toLowerCase();
    const filters = extractTAFilters(req.query);
    const user = req.user!;
    const dateStr = manilaDateString();

    if (format === "xlsx") {
      const buffer = await generatePipelineReportXLSX(user, filters, "TALENT_ACQUISITION");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="MEGS_TA_Candidate_Pipeline_Report_${dateStr}.xlsx"`
      );
      res.send(buffer);
    } else {
      const buffer = await generatePipelineReportPDF(user, filters, "TALENT_ACQUISITION");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="MEGS_TA_Candidate_Pipeline_Report_${dateStr}.pdf"`
      );
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportDeploymentReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = (req.query.format as string || "pdf").toLowerCase();
    const filters = extractTAFilters(req.query);
    const user = req.user!;
    const dateStr = manilaDateString();

    if (format === "xlsx") {
      const buffer = await generateDeploymentReportXLSX(user, filters, "TALENT_ACQUISITION");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="MEGS_TA_Deployment_Report_${dateStr}.xlsx"`
      );
      res.send(buffer);
    } else {
      const buffer = await generateDeploymentReportPDF(user, filters, "TALENT_ACQUISITION");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="MEGS_TA_Deployment_Report_${dateStr}.pdf"`
      );
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
