import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import prisma from "../../utils/prisma.js";
import type { AnalyticsFilterDto } from "./analytics.service.js";

const safeFormatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? "N/A" : d.toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
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
  requestedBy: { id: string; email: string },
  filters?: AnalyticsFilterDto
): Promise<Buffer> => {
  const where = buildApplicationWhere(filters);

  const applications = await prisma.application.findMany({
    where,
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          title: true,
          mrf: { select: { id: true, title: true } },
        },
      },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Header
    doc.fontSize(18).text("MEGS Recruitment - Pipeline Analytics Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Requested By: ${requestedBy.email}`);
    doc.text(`Applied Filters: ${filterSummary}`);
    doc.text(`Total Matching Records: ${applications.length}`);
    doc.moveDown(1);

    // Table Header
    doc.fontSize(10).font("Helvetica-Bold").text("App ID | Applicant Name | Job Title | MRF | Status | Applied Date");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9);

    if (applications.length === 0) {
      doc.font("Helvetica-Oblique").text("No records found matching the specified filter criteria.");
      doc.font("Helvetica");
    } else {
      for (const app of applications) {
        const name = app.user.applicantProfile
          ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
          : app.user.email;
        const mrfTitle = app.jobPosting?.mrf?.title ? `MRF-${app.jobPosting.mrf.id}` : "Direct";
        doc.text(`#${app.id} | ${name} | ${app.jobPosting?.title || "N/A"} | ${mrfTitle} | ${app.status} | ${safeFormatDate(app.createdAt)}`);
      }
    }

    doc.end();
  });
};

export const generatePipelineReportXLSX = async (
  requestedBy: { id: string; email: string },
  filters?: AnalyticsFilterDto
): Promise<Buffer> => {
  const where = buildApplicationWhere(filters);

  const applications = await prisma.application.findMany({
    where,
    take: 500,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: {
        select: {
          title: true,
          mrf: { select: { id: true, title: true } },
        },
      },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Pipeline Report");

  sheet.columns = [
    { header: "Application ID", key: "id", width: 15 },
    { header: "Applicant Email", key: "email", width: 25 },
    { header: "Applicant Name", key: "name", width: 25 },
    { header: "Job Title", key: "job", width: 25 },
    { header: "MRF Order", key: "mrf", width: 25 },
    { header: "Status", key: "status", width: 20 },
    { header: "AI Score", key: "aiScore", width: 12 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];

  for (const app of applications) {
    const name = app.user.applicantProfile
      ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
      : "N/A";
    sheet.addRow({
      id: app.id,
      email: app.user.email,
      name,
      job: app.jobPosting?.title || "N/A",
      mrf: app.jobPosting?.mrf?.title || "Direct",
      status: app.status,
      aiScore: app.aiScore ?? "N/A",
      createdAt: safeFormatDate(app.createdAt),
    });
  }

  // Metadata footer row
  sheet.addRow({});
  sheet.addRow({
    id: `Generated At: ${new Date().toISOString()}`,
    email: `Requested By: ${requestedBy.email}`,
    name: `Filters: ${buildFilterDescription(filters)}`,
    job: `Count: ${applications.length}`,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
};

export const generateDeploymentReportPDF = async (
  requestedBy: { id: string; email: string },
  filters?: AnalyticsFilterDto
): Promise<Buffer> => {
  const where = buildDeploymentWhere(filters);

  const deployments = await prisma.deployment.findMany({
    where,
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      mrf: { select: { title: true } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      application: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  const filterSummary = buildFilterDescription(filters);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc.fontSize(18).text("MEGS Recruitment - Deployment Lifecycle Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Requested By: ${requestedBy.email}`);
    doc.text(`Applied Filters: ${filterSummary}`);
    doc.text(`Total Matching Records: ${deployments.length}`);
    doc.moveDown(1);

    doc.fontSize(10).font("Helvetica-Bold").text("ID | Client | Candidate | Status | Site | Contract Start");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9);

    if (deployments.length === 0) {
      doc.font("Helvetica-Oblique").text("No deployments found matching the specified filter criteria.");
      doc.font("Helvetica");
    } else {
      for (const dep of deployments) {
        const user = dep.employee?.user || dep.application?.user;
        const name = user?.applicantProfile
          ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
          : user?.email || "Unknown";
        doc.text(`#${dep.id} | ${dep.client.name} | ${name} | ${dep.status} | ${dep.site || "N/A"} | ${safeFormatDate(dep.contractStart)}`);
      }
    }

    doc.end();
  });
};

export const generateDeploymentReportXLSX = async (
  requestedBy: { id: string; email: string },
  filters?: AnalyticsFilterDto
): Promise<Buffer> => {
  const where = buildDeploymentWhere(filters);

  const deployments = await prisma.deployment.findMany({
    where,
    take: 500,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      mrf: { select: { title: true } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      application: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Deployments Report");

  sheet.columns = [
    { header: "Deployment ID", key: "id", width: 15 },
    { header: "Client Name", key: "client", width: 25 },
    { header: "MRF Title", key: "mrf", width: 25 },
    { header: "Candidate Name", key: "candidate", width: 25 },
    { header: "Status", key: "status", width: 22 },
    { header: "Site Location", key: "site", width: 20 },
    { header: "Contract Start", key: "start", width: 15 },
    { header: "Contract End", key: "end", width: 15 },
  ];

  for (const dep of deployments) {
    const user = dep.employee?.user || dep.application?.user;
    const name = user?.applicantProfile
      ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
      : user?.email || "Unknown";
    sheet.addRow({
      id: dep.id,
      client: dep.client.name,
      mrf: dep.mrf?.title || "N/A",
      candidate: name,
      status: dep.status,
      site: dep.site || "N/A",
      start: safeFormatDate(dep.contractStart),
      end: safeFormatDate(dep.contractEnd),
    });
  }

  sheet.addRow({});
  sheet.addRow({
    id: `Generated At: ${new Date().toISOString()}`,
    client: `Requested By: ${requestedBy.email}`,
    mrf: `Filters: ${buildFilterDescription(filters)}`,
    candidate: `Count: ${deployments.length}`,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
};

