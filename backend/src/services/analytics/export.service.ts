import prisma from "../../utils/prisma.js";
import type { AnalyticsFilterDto } from "./analytics.service.js";
import {
  getReportMetadata,
  ReportRoleScope,
} from "./report-theme.js";
import {
  createHRDocument,
  renderCorporateHeader,
  renderSummaryKPIs,
  renderGridTable,
  renderFootersAndPagination,
  ColumnDef,
} from "./report-pdf-builder.js";
import {
  createHRExcelWorkbook,
  applySpreadsheetHeaderBlock,
  applyTableHeaders,
  applyDataRowsAndFormatting,
  writeWorkbookToBuffer,
  ExcelColumnDef,
} from "./report-excel-builder.js";

const safeFormatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? "N/A" : d.toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
};

const resolveRoleScope = (
  requestedBy: { id: string; email: string; role?: string },
  explicitScope?: ReportRoleScope
): ReportRoleScope => {
  if (explicitScope) return explicitScope;
  if (requestedBy.role === "ADMINISTRATOR") return "ADMINISTRATOR";
  return "TALENT_ACQUISITION";
};

const buildFilterDescription = (filters?: AnalyticsFilterDto): string => {
  if (!filters) return "Default: Last 30 Days (All Records)";
  const parts: string[] = [];
  if (filters.mrfId) parts.push(`MRF #${filters.mrfId}`);
  if (filters.jobPostingId) parts.push(`Job #${filters.jobPostingId}`);
  if (filters.stage) parts.push(`Stage: ${filters.stage}`);
  if (filters.clientId) parts.push(`Client #${filters.clientId}`);
  if (filters.recruiterId) parts.push(`Recruiter: ${filters.recruiterId}`);
  if (filters.startDate && filters.endDate) {
    parts.push(`Date: ${filters.startDate} to ${filters.endDate}`);
  } else if (filters.range) {
    parts.push(`Range: ${filters.range.toUpperCase()}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "All Records (Last 30 Days)";
};

const buildApplicationWhere = (filters?: AnalyticsFilterDto) => {
  const where: any = {};
  const jobWhere: any = {};

  if (filters?.mrfId) {
    jobWhere.mrfId = filters.mrfId;
  }
  if (filters?.clientId) {
    jobWhere.mrf = { clientId: filters.clientId };
  }
  if (filters?.recruiterId) {
    jobWhere.postedById = filters.recruiterId;
  }

  if (Object.keys(jobWhere).length > 0) {
    where.jobPosting = jobWhere;
  }

  if (filters?.jobPostingId) {
    where.jobPostingId = filters.jobPostingId;
  }

  if (filters?.stage) {
    where.status = filters.stage;
  }

  if (filters?.startDate && filters?.endDate) {
    where.createdAt = {
      gte: new Date(filters.startDate),
      lte: new Date(`${filters.endDate}T23:59:59.999Z`),
    };
  } else if (filters?.range && filters.range !== "custom") {
    const days = filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: start };
  }

  return where;
};

const buildDeploymentWhere = (filters?: AnalyticsFilterDto) => {
  const where: any = {};

  if (filters?.mrfId) {
    where.mrfId = filters.mrfId;
  }
  if (filters?.clientId) {
    where.clientId = filters.clientId;
  }
  if (filters?.jobPostingId) {
    where.application = { jobPostingId: filters.jobPostingId };
  }
  if (filters?.startDate && filters?.endDate) {
    where.createdAt = {
      gte: new Date(filters.startDate),
      lte: new Date(`${filters.endDate}T23:59:59.999Z`),
    };
  } else if (filters?.range && filters.range !== "custom") {
    const days = filters.range === "7d" ? 7 : filters.range === "90d" ? 90 : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    where.createdAt = { gte: start };
  }

  return where;
};

export const generatePipelineReportPDF = async (
  requestedBy: { id: string; email: string; role?: string },
  filters?: AnalyticsFilterDto,
  roleScopeOverride?: ReportRoleScope
): Promise<Buffer> => {
  const roleScope = resolveRoleScope(requestedBy, roleScopeOverride);
  const where = buildApplicationWhere(filters);

  const applications = await prisma.application.findMany({
    where,
    take: 300,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          title: true,
          mrf: { select: { id: true, title: true, client: { select: { name: true } } } },
          postedBy: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
        },
      },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);
  const meta = getReportMetadata({
    reportType: "PIPELINE",
    roleScope,
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const doc = createHRDocument({ orientation: "landscape" });
  renderCorporateHeader(doc, meta);

  // Compute summary KPI metrics
  const totalApps = applications.length;
  const activeScreening = applications.filter((a) =>
    ["INITIAL_SCREENING", "AI_SCREENING", "INTERVIEW"].includes(a.status)
  ).length;
  const endorsedOrHired = applications.filter((a) =>
    ["CLIENT_ENDORSEMENT", "HIRED", "DEPLOYED"].includes(a.status)
  ).length;
  const avgScore =
    totalApps > 0
      ? (
          applications.reduce((acc, a) => acc + (a.aiScore || 0), 0) /
          applications.filter((a) => a.aiScore !== null && a.aiScore !== undefined).length || 0
        ).toFixed(1) + "%"
      : "N/A";

  renderSummaryKPIs(doc, [
    { label: "Total Applications", value: totalApps },
    { label: "Active in Pipeline", value: activeScreening },
    { label: "Endorsed / Placed", value: endorsedOrHired },
    { label: "Avg AI Match Score", value: avgScore },
  ]);

  let columns: ColumnDef[];
  let rows: (string | number | null | undefined)[][];

  if (roleScope === "TALENT_ACQUISITION") {
    columns = [
      { header: "App ID", width: 55, align: "center" },
      { header: "Candidate Name", width: 135, align: "left" },
      { header: "Candidate Email", width: 130, align: "left" },
      { header: "Applied Job Role", width: 150, align: "left" },
      { header: "MRF Order", width: 90, align: "left" },
      { header: "Pipeline Stage", width: 100, align: "center", badge: true },
      { header: "AI Match", width: 55, align: "right" },
      { header: "Applied", width: 55, align: "center" },
    ];

    rows = applications.map((app) => {
      const name = app.user.applicantProfile
        ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
        : "N/A";
      const mrfTitle = app.jobPosting?.mrf?.title ? `MRF-${app.jobPosting.mrf.id}` : "Direct";
      const score = app.aiScore !== null && app.aiScore !== undefined ? `${app.aiScore}%` : "N/A";
      return [
        `#${app.id}`,
        name,
        app.user.email,
        app.jobPosting?.title || "N/A",
        mrfTitle,
        app.status,
        score,
        safeFormatDate(app.createdAt),
      ];
    });
  } else {
    // Administrator Role: Executive governance view
    columns = [
      { header: "Record ID", width: 50, align: "center" },
      { header: "Candidate Name", width: 125, align: "left" },
      { header: "Client Partner", width: 125, align: "left" },
      { header: "MRF Requisition", width: 110, align: "left" },
      { header: "Assigned Recruiter", width: 120, align: "left" },
      { header: "Processing Stage", width: 105, align: "center", badge: true },
      { header: "AI Match", width: 60, align: "right" },
      { header: "Submission Date", width: 75, align: "center" },
    ];

    rows = applications.map((app) => {
      const name = app.user.applicantProfile
        ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
        : "N/A";
      const clientName = app.jobPosting?.mrf?.client?.name || "Direct Requisition";
      const mrfTitle = app.jobPosting?.mrf?.title || (app.jobPosting?.mrf?.id ? `MRF-${app.jobPosting.mrf.id}` : "N/A");
      const recruiter = app.jobPosting?.postedBy?.applicantProfile
        ? `${app.jobPosting.postedBy.applicantProfile.firstName} ${app.jobPosting.postedBy.applicantProfile.lastName}`
        : app.jobPosting?.postedBy?.email || "Unassigned";
      const score = app.aiScore !== null && app.aiScore !== undefined ? `${app.aiScore}%` : "N/A";

      return [
        `#${app.id}`,
        name,
        clientName,
        mrfTitle,
        recruiter,
        app.status,
        score,
        safeFormatDate(app.createdAt),
      ];
    });
  }

  renderGridTable(doc, { columns, rows });
  return renderFootersAndPagination(doc, meta);
};

export const generatePipelineReportXLSX = async (
  requestedBy: { id: string; email: string; role?: string },
  filters?: AnalyticsFilterDto,
  roleScopeOverride?: ReportRoleScope
): Promise<Buffer> => {
  const roleScope = resolveRoleScope(requestedBy, roleScopeOverride);
  const where = buildApplicationWhere(filters);

  const applications = await prisma.application.findMany({
    where,
    take: 1000,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          title: true,
          mrf: { select: { id: true, title: true, client: { select: { name: true } } } },
          postedBy: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
        },
      },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);
  const meta = getReportMetadata({
    reportType: "PIPELINE",
    roleScope,
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const { workbook, worksheet } = createHRExcelWorkbook(meta, "Candidate Pipeline");
  applySpreadsheetHeaderBlock(worksheet, meta);

  let columns: ExcelColumnDef[];
  let rows: Record<string, any>[];

  if (roleScope === "TALENT_ACQUISITION") {
    columns = [
      { header: "Application ID", key: "id", minWidth: 15, align: "center" },
      { header: "Candidate Name", key: "name", minWidth: 24 },
      { header: "Applicant Email", key: "email", minWidth: 26 },
      { header: "Job Title", key: "job", minWidth: 26 },
      { header: "MRF Order", key: "mrf", minWidth: 20 },
      { header: "Pipeline Status", key: "status", minWidth: 22, align: "center" },
      { header: "AI Match Score", key: "aiScore", minWidth: 16, align: "right" },
      { header: "Applied Date", key: "createdAt", minWidth: 16, align: "center" },
    ];

    rows = applications.map((app) => {
      const name = app.user.applicantProfile
        ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
        : "N/A";
      return {
        id: app.id,
        name,
        email: app.user.email,
        job: app.jobPosting?.title || "N/A",
        mrf: app.jobPosting?.mrf?.title || (app.jobPosting?.mrf?.id ? `MRF-${app.jobPosting.mrf.id}` : "Direct"),
        status: app.status,
        aiScore: app.aiScore !== null && app.aiScore !== undefined ? app.aiScore : "N/A",
        createdAt: safeFormatDate(app.createdAt),
      };
    });
  } else {
    // Administrator View
    columns = [
      { header: "Record ID", key: "id", minWidth: 14, align: "center" },
      { header: "Candidate Name", key: "name", minWidth: 24 },
      { header: "Candidate Email", key: "email", minWidth: 26 },
      { header: "Client Partner", key: "client", minWidth: 26 },
      { header: "MRF Order", key: "mrf", minWidth: 20 },
      { header: "Job Title", key: "job", minWidth: 24 },
      { header: "Responsible Recruiter", key: "recruiter", minWidth: 24 },
      { header: "Processing Stage", key: "status", minWidth: 22, align: "center" },
      { header: "AI Match Score", key: "aiScore", minWidth: 16, align: "right" },
      { header: "Submission Date", key: "createdAt", minWidth: 16, align: "center" },
    ];

    rows = applications.map((app) => {
      const name = app.user.applicantProfile
        ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
        : "N/A";
      const clientName = app.jobPosting?.mrf?.client?.name || "Direct Requisition";
      const mrfTitle = app.jobPosting?.mrf?.title || (app.jobPosting?.mrf?.id ? `MRF-${app.jobPosting.mrf.id}` : "N/A");
      const recruiter = app.jobPosting?.postedBy?.applicantProfile
        ? `${app.jobPosting.postedBy.applicantProfile.firstName} ${app.jobPosting.postedBy.applicantProfile.lastName}`
        : app.jobPosting?.postedBy?.email || "Unassigned";

      return {
        id: app.id,
        name,
        email: app.user.email,
        client: clientName,
        mrf: mrfTitle,
        job: app.jobPosting?.title || "N/A",
        recruiter,
        status: app.status,
        aiScore: app.aiScore !== null && app.aiScore !== undefined ? app.aiScore : "N/A",
        createdAt: safeFormatDate(app.createdAt),
      };
    });
  }

  applyTableHeaders(worksheet, 7, columns);
  applyDataRowsAndFormatting(worksheet, 7, columns, rows);

  return writeWorkbookToBuffer(workbook);
};

export const generateDeploymentReportPDF = async (
  requestedBy: { id: string; email: string; role?: string },
  filters?: AnalyticsFilterDto,
  roleScopeOverride?: ReportRoleScope
): Promise<Buffer> => {
  const roleScope = resolveRoleScope(requestedBy, roleScopeOverride);
  const where = buildDeploymentWhere(filters);

  const deployments = await prisma.deployment.findMany({
    where,
    take: 300,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      mrf: { select: { title: true } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      application: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);
  const meta = getReportMetadata({
    reportType: "DEPLOYMENT",
    roleScope,
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const doc = createHRDocument({ orientation: "landscape" });
  renderCorporateHeader(doc, meta);

  const totalDeployments = deployments.length;
  const activeDeployments = deployments.filter((d) => ["DEPLOYED", "ON_SITE", "ACTIVE"].includes(d.status)).length;
  const pendingDeployments = deployments.filter((d) => ["PENDING", "PROCESSING", "SCHEDULED"].includes(d.status)).length;
  const clientCount = new Set(deployments.map((d) => d.client?.name).filter(Boolean)).size;

  renderSummaryKPIs(doc, [
    { label: "Total Deployments", value: totalDeployments },
    { label: "Active on Site", value: activeDeployments },
    { label: "Pending Processing", value: pendingDeployments },
    { label: "Client Partners", value: clientCount },
  ]);

  let columns: ColumnDef[];
  let rows: (string | number | null | undefined)[][];

  if (roleScope === "TALENT_ACQUISITION") {
    columns = [
      { header: "Placement ID", width: 65, align: "center" },
      { header: "Candidate Name", width: 140, align: "left" },
      { header: "Client Partner", width: 140, align: "left" },
      { header: "MRF Role", width: 120, align: "left" },
      { header: "Deployment Status", width: 110, align: "center", badge: true },
      { header: "Site Location", width: 95, align: "left" },
      { header: "Contract Start", width: 50, align: "center" },
      { header: "Contract End", width: 50, align: "center" },
    ];

    rows = deployments.map((dep) => {
      const user = dep.employee?.user || dep.application?.user;
      const name = user?.applicantProfile
        ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
        : user?.email || "Unknown";

      return [
        `#${dep.id}`,
        name,
        dep.client.name,
        dep.mrf?.title || "N/A",
        dep.status,
        dep.site || "N/A",
        safeFormatDate(dep.contractStart),
        safeFormatDate(dep.contractEnd),
      ];
    });
  } else {
    // Administrator View
    columns = [
      { header: "Deployment ID", width: 65, align: "center" },
      { header: "Client Organization", width: 145, align: "left" },
      { header: "Department / MRF", width: 120, align: "left" },
      { header: "Placed Employee", width: 135, align: "left" },
      { header: "Placement Status", width: 110, align: "center", badge: true },
      { header: "Assigned Facility", width: 95, align: "left" },
      { header: "Contract Period", width: 100, align: "center" },
    ];

    rows = deployments.map((dep) => {
      const user = dep.employee?.user || dep.application?.user;
      const name = user?.applicantProfile
        ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
        : user?.email || "Unknown";

      const period = `${safeFormatDate(dep.contractStart)} to ${safeFormatDate(dep.contractEnd)}`;

      return [
        `#${dep.id}`,
        dep.client.name,
        dep.mrf?.title || "N/A",
        name,
        dep.status,
        dep.site || "N/A",
        period,
      ];
    });
  }

  renderGridTable(doc, { columns, rows });
  return renderFootersAndPagination(doc, meta);
};

export const generateDeploymentReportXLSX = async (
  requestedBy: { id: string; email: string; role?: string },
  filters?: AnalyticsFilterDto,
  roleScopeOverride?: ReportRoleScope
): Promise<Buffer> => {
  const roleScope = resolveRoleScope(requestedBy, roleScopeOverride);
  const where = buildDeploymentWhere(filters);

  const deployments = await prisma.deployment.findMany({
    where,
    take: 1000,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      mrf: { select: { title: true } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      application: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);
  const meta = getReportMetadata({
    reportType: "DEPLOYMENT",
    roleScope,
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const { workbook, worksheet } = createHRExcelWorkbook(meta, "Deployments");
  applySpreadsheetHeaderBlock(worksheet, meta);

  let columns: ExcelColumnDef[];
  let rows: Record<string, any>[];

  if (roleScope === "TALENT_ACQUISITION") {
    columns = [
      { header: "Deployment ID", key: "id", minWidth: 15, align: "center" },
      { header: "Candidate Name", key: "candidate", minWidth: 24 },
      { header: "Client Partner", key: "client", minWidth: 25 },
      { header: "MRF Title", key: "mrf", minWidth: 25 },
      { header: "Deployment Status", key: "status", minWidth: 22, align: "center" },
      { header: "Site Location", key: "site", minWidth: 22 },
      { header: "Contract Start", key: "start", minWidth: 16, align: "center" },
      { header: "Contract End", key: "end", minWidth: 16, align: "center" },
    ];

    rows = deployments.map((dep) => {
      const user = dep.employee?.user || dep.application?.user;
      const name = user?.applicantProfile
        ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
        : user?.email || "Unknown";

      return {
        id: dep.id,
        candidate: name,
        client: dep.client.name,
        mrf: dep.mrf?.title || "N/A",
        status: dep.status,
        site: dep.site || "N/A",
        start: safeFormatDate(dep.contractStart),
        end: safeFormatDate(dep.contractEnd),
      };
    });
  } else {
    // Administrator View
    columns = [
      { header: "Deployment ID", key: "id", minWidth: 15, align: "center" },
      { header: "Client Organization", key: "client", minWidth: 26 },
      { header: "Department / MRF", key: "mrf", minWidth: 24 },
      { header: "Placed Employee", key: "candidate", minWidth: 24 },
      { header: "Placement Status", key: "status", minWidth: 22, align: "center" },
      { header: "Assigned Facility", key: "site", minWidth: 22 },
      { header: "Contract Start", key: "start", minWidth: 16, align: "center" },
      { header: "Contract End", key: "end", minWidth: 16, align: "center" },
    ];

    rows = deployments.map((dep) => {
      const user = dep.employee?.user || dep.application?.user;
      const name = user?.applicantProfile
        ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
        : user?.email || "Unknown";

      return {
        id: dep.id,
        client: dep.client.name,
        mrf: dep.mrf?.title || "N/A",
        candidate: name,
        status: dep.status,
        site: dep.site || "N/A",
        start: safeFormatDate(dep.contractStart),
        end: safeFormatDate(dep.contractEnd),
      };
    });
  }

  applyTableHeaders(worksheet, 7, columns);
  applyDataRowsAndFormatting(worksheet, 7, columns, rows);

  return writeWorkbookToBuffer(workbook);
};
