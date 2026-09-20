import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  getPipelineStats,
  getTimeToFillStats,
  getDeploymentStats,
  getComplianceOverview,
  getTAOverviewStats,
  getRecruitmentActivityTrend,
  getAdminFunnelAnalytics,
  getTAPendingActions,
  getAnalyticsFilterOptions,
  AnalyticsFilterDto,
} from "../../services/analytics/analytics.service.js";
import {
  generatePipelineReportPDF,
  generatePipelineReportXLSX,
  generateDeploymentReportPDF,
  generateDeploymentReportXLSX,
} from "../../services/analytics/export.service.js";

function extractTAFilters(query: any): AnalyticsFilterDto {
  return {
    range: query.range as any,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    clientId: query.clientId ? parseInt(query.clientId as string, 10) : undefined,
    mrfId: query.mrfId ? parseInt(query.mrfId as string, 10) : undefined,
    jobPostingId: query.jobPostingId ? parseInt(query.jobPostingId as string, 10) : undefined,
    stage: query.stage as string,
    mineOnly: query.mineOnly === "true" || query.mineOnly === true,
  };
}

export const getTAOverviewHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractTAFilters(req.query);
    const stats = await getTAOverviewStats(req.user!.id, filters);
    sendSuccess(res, "TA overview metrics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getTAActivityTrendHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractTAFilters(req.query);
    const trend = await getRecruitmentActivityTrend(filters, {
      role: req.user!.role,
      userId: req.user!.id,
    });
    sendSuccess(res, "TA recruitment activity trend retrieved", trend);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getTAPipelineFunnelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractTAFilters(req.query);
    const funnel = await getAdminFunnelAnalytics({
      ...filters,
      recruiterId: filters.mineOnly ? req.user!.id : undefined,
    });
    sendSuccess(res, "TA pipeline funnel analytics retrieved", funnel);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

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
    const userId = req.user!.id;
    const [overview, activity, funnel, pendingActions, filterOptions] = await Promise.all([
      getTAOverviewStats(userId, filters),
      getRecruitmentActivityTrend(filters, { role: req.user!.role, userId }),
      getAdminFunnelAnalytics({
        ...filters,
        recruiterId: filters.mineOnly ? userId : undefined,
      }),
      getTAPendingActions(userId, filters),
      getAnalyticsFilterOptions("TALENT_ACQUISITION", userId),
    ]);

    sendSuccess(res, "TA unified analytics dashboard retrieved", {
      overview,
      activity,
      funnel,
      pendingActions,
      filterOptions,
    });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

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
    const filters = extractTAFilters(req.query);
    const user = req.user!;
    const dateStr = new Date().toISOString().slice(0, 10);

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
    const dateStr = new Date().toISOString().slice(0, 10);

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
