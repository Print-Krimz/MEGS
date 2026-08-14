import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import prisma from "../../utils/prisma.js";

const safeFormatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? "N/A" : d.toISOString().split("T")[0];
  } catch {
    return "N/A";
  }
};

export const generatePipelineReportPDF = async (requestedBy: { id: string; email: string }): Promise<Buffer> => {
  const applications = await prisma.application.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: { select: { title: true } },
      user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    // Header
    doc.fontSize(18).text("Pipeline Analytics Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated At: ${new Date().toISOString()}`);
    doc.text(`Requested By: ${requestedBy.email} (${requestedBy.id})`);
    doc.moveDown(1);

    // Table Header
    doc.fontSize(11).text("ID | Applicant | Job Title | Status | Date", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10);
    for (const app of applications) {
      const name = app.user.applicantProfile
        ? `${app.user.applicantProfile.firstName} ${app.user.applicantProfile.lastName}`
        : app.user.email;
      doc.text(`#${app.id} | ${name} | ${app.jobPosting?.title || "N/A"} | ${app.status} | ${safeFormatDate(app.createdAt)}`);
    }

    doc.end();
  });
};

export const generatePipelineReportXLSX = async (requestedBy: { id: string; email: string }): Promise<Buffer> => {
  const applications = await prisma.application.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      jobPosting: { select: { title: true } },
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
      status: app.status,
      aiScore: app.aiScore ?? "N/A",
      createdAt: safeFormatDate(app.createdAt),
    });
  }

  // Metadata footer row
  sheet.addRow({});
  sheet.addRow({ id: `Generated At: ${new Date().toISOString()}`, email: `Requested By: ${requestedBy.email}` });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
};

export const generateDeploymentReportPDF = async (requestedBy: { id: string; email: string }): Promise<Buffer> => {
  const deployments = await prisma.deployment.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { name: true } },
      mrf: { select: { title: true } },
      employee: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
      application: { select: { user: { select: { email: true, applicantProfile: { select: { firstName: true, lastName: true } } } } } },
    },
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    doc.fontSize(18).text("Deployment Lifecycle Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated At: ${new Date().toISOString()}`);
    doc.text(`Requested By: ${requestedBy.email} (${requestedBy.id})`);
    doc.moveDown(1);

    doc.fontSize(11).text("ID | Client | Candidate | Status | Site | Start Date", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10);
    for (const dep of deployments) {
      const user = dep.employee?.user || dep.application?.user;
      const name = user?.applicantProfile
        ? `${user.applicantProfile.firstName} ${user.applicantProfile.lastName}`
        : user?.email || "Unknown";
      doc.text(`#${dep.id} | ${dep.client.name} | ${name} | ${dep.status} | ${dep.site || "N/A"} | ${safeFormatDate(dep.contractStart)}`);
    }

    doc.end();
  });
};

export const generateDeploymentReportXLSX = async (requestedBy: { id: string; email: string }): Promise<Buffer> => {
  const deployments = await prisma.deployment.findMany({
    take: 100,
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
  sheet.addRow({ id: `Generated At: ${new Date().toISOString()}`, client: `Requested By: ${requestedBy.email}` });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any);
};
