import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { manilaDateString } from "../../schemas/field-limits.js";
import {
  getAnalyticsFilterOptions,
  AnalyticsFilterDto,
} from "../../services/analytics/analytics.service.js";
import { getAdminDelivery } from "../../services/analytics/delivery.service.js";
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
    const [delivery, filterOptions] = await Promise.all([
      getAdminDelivery(filters),
      getAnalyticsFilterOptions("ADMINISTRATOR", req.user?.id),
    ]);

    sendSuccess(res, "Admin analytics dashboard retrieved", { ...delivery, filterOptions });
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};
export const exportAdminPipelineReportHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = ((req.query.format as string) || "pdf").toLowerCase();
    const filters = extractFilters(req.query);
    const user = req.user!;
    const dateStr = manilaDateString();

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
    const dateStr = manilaDateString();

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
