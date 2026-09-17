import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  getAdminOverviewStats,
  getRecruitmentActivityTrend,
  getAdminFunnelAnalytics,
  getAdminBottlenecks,
  getApplicationsByJobAndMRF,
  getAnalyticsFilterOptions,
  AnalyticsFilterDto,
} from "../../services/analytics/analytics.service.js";
import {
  generatePipelineReportPDF,
  generatePipelineReportXLSX,
  generateDeploymentReportPDF,
  generateDeploymentReportXLSX,
} from "../../services/analytics/export.service.js";

function extractFilters(query: any): AnalyticsFilterDto {
  return {
    range: query.range as any,
    startDate: query.startDate as string,
    endDate: query.endDate as string,
    clientId: query.clientId ? parseInt(query.clientId as string, 10) : undefined,
    mrfId: query.mrfId ? parseInt(query.mrfId as string, 10) : undefined,
    jobPostingId: query.jobPostingId ? parseInt(query.jobPostingId as string, 10) : undefined,
    stage: query.stage as string,
    recruiterId: query.recruiterId as string,
  };
}

export const getAdminOverviewHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const stats = await getAdminOverviewStats(filters);
    sendSuccess(res, "Admin overview analytics retrieved", stats);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminActivityTrendHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const trend = await getRecruitmentActivityTrend(filters);
    sendSuccess(res, "Recruitment activity trend retrieved", trend);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminFunnelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const funnel = await getAdminFunnelAnalytics(filters);
    sendSuccess(res, "Recruitment funnel analytics retrieved", funnel);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminBottlenecksHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const bottlenecks = await getAdminBottlenecks(filters);
    sendSuccess(res, "Recruitment bottlenecks retrieved", bottlenecks);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminJobDemandsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const jobDemands = await getApplicationsByJobAndMRF(filters);
    sendSuccess(res, "Applications by job and MRF retrieved", jobDemands);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminFilterOptionsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const options = await getAnalyticsFilterOptions("ADMINISTRATOR", req.user?.id);
    sendSuccess(res, "Analytics filter options retrieved", options);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getAdminDashboardSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters = extractFilters(req.query);
    const [overview, activity, funnel, bottlenecks, jobDemands, filterOptions] = await Promise.all([
      getAdminOverviewStats(filters),
      getRecruitmentActivityTrend(filters),
      getAdminFunnelAnalytics(filters),
      getAdminBottlenecks(filters),
      getApplicationsByJobAndMRF(filters),
      getAnalyticsFilterOptions("ADMINISTRATOR", req.user?.id),
    ]);

    sendSuccess(res, "Admin unified analytics dashboard retrieved", {
      overview,
      activity,
      funnel,
      bottlenecks,
      jobDemands,
      filterOptions,
    });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportAdminPipelineReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = ((req.query.format as string) || "pdf").toLowerCase();
    const filters = extractFilters(req.query);
    const user = req.user!;
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "xlsx") {
      const buffer = await generatePipelineReportXLSX(user, filters, "ADMINISTRATOR");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="MEGS_Admin_Workforce_Pipeline_Report_${dateStr}.xlsx"`
      );
      res.send(buffer);
    } else {
      const buffer = await generatePipelineReportPDF(user, filters, "ADMINISTRATOR");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="MEGS_Admin_Workforce_Pipeline_Report_${dateStr}.pdf"`
      );
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const exportAdminDeploymentReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = ((req.query.format as string) || "pdf").toLowerCase();
    const filters = extractFilters(req.query);
    const user = req.user!;
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "xlsx") {
      const buffer = await generateDeploymentReportXLSX(user, filters, "ADMINISTRATOR");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="MEGS_Admin_Deployment_Governance_${dateStr}.xlsx"`
      );
      res.send(buffer);
    } else {
      const buffer = await generateDeploymentReportPDF(user, filters, "ADMINISTRATOR");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="MEGS_Admin_Deployment_Governance_${dateStr}.pdf"`
      );
      res.send(buffer);
    }
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
