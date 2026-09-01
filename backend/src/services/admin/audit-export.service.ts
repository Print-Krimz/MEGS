import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { fetchAuditLogs } from "./admin.service.js";
import { logAudit } from "../../utils/audit.js";

const safeFormatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "N/A";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return isNaN(d.getTime()) ? "N/A" : d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return "N/A";
  }
};

const resolveActorName = (log: any): string => {
  if (log.user?.applicantProfile?.firstName || log.user?.applicantProfile?.lastName) {
    return `${log.user.applicantProfile.firstName || ""} ${log.user.applicantProfile.lastName || ""}`.trim();
  }
  if (log.user?.email) return log.user.email;

  let details: any = {};
  try {
    details = typeof log.details === "string" ? JSON.parse(log.details) : log.details || {};
  } catch {}

  const explicit =
    details.actorName ||
    details.interviewerName ||
    details.evaluatorName ||
    details.recruiterName ||
    details.userName ||
    details.actorEmail;
  if (explicit) return String(explicit);

  const action = (log.action || "").toUpperCase();
  if (action.includes("INTERVIEW") || action.includes("STAGE") || action.includes("APPLICATION") || action.includes("ENDORSEMENT")) {
    return "Talent Acquisition Specialist";
  }
  if (action.includes("BACKUP") || action.includes("CONFIG")) {
    return "System Administrator";
  }
  if (action.includes("COMPLIANCE")) {
    return "Compliance Officer";
  }
  return "Talent Acquisition Specialist";
};

export const generateAuditReportPDF = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await fetchAuditLogs({
    ...filters,
    limit: filters?.limit ? parseInt(String(filters.limit), 10) : 500,
  });

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      logAudit(
        requestedBy.id,
        "SECURITY_AUDIT_REPORT_EXPORT_PDF",
        "AuditLog",
        null,
        {
          recordsCount: logs.length,
          filters: filters || {},
        }
      ).catch(() => null);
      resolve(buffer);
    });
    doc.on("error", reject);

    // Document Header
    doc.fontSize(16).font("Helvetica-Bold").text("MEGS - SECURITY AUDIT REPORT", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).font("Helvetica").text("Metropolitan Employment Generation System • Administrative Governance", { align: "center" });
    doc.moveDown(0.8);

    // Meta Block
    doc.fontSize(9).font("Helvetica-Bold").text("REPORT METADATA:");
    doc.font("Helvetica");
    doc.text(`Generated At: ${new Date().toISOString()}`);
    doc.text(`Requested By: ${requestedBy.email}`);
    doc.text(`Total Events Exported: ${logs.length}`);
    if (filters && Object.keys(filters).length > 0) {
      doc.text(`Filters Applied: ${JSON.stringify(filters)}`);
    }
    doc.moveDown(1);

    // Table Header
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Timestamp           | Action                         | Actor                         | Target Entity");
    doc.text("--------------------------------------------------------------------------------------------------");
    doc.font("Helvetica").fontSize(8);

    if (logs.length === 0) {
      doc.font("Helvetica-Oblique").text("No audit log events match the selected criteria.");
    } else {
      for (const log of logs) {
        const actor = resolveActorName(log);
        const target = log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ""}` : "N/A";
        const ts = safeFormatDate(log.createdAt);

        doc.text(`${ts.padEnd(20)} | ${log.action.slice(0, 30).padEnd(30)} | ${actor.slice(0, 30).padEnd(30)} | ${target}`);
      }
    }

    doc.end();
  });
};

export const generateAuditReportCSV = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await fetchAuditLogs({
    ...filters,
    limit: filters?.limit ? parseInt(String(filters.limit), 10) : 5000,
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Security Audit Trail");

  worksheet.columns = [
    { header: "Log ID", key: "id", width: 10 },
    { header: "Timestamp", key: "createdAt", width: 22 },
    { header: "Action", key: "action", width: 30 },
    { header: "Actor", key: "actor", width: 30 },
    { header: "Actor Role", key: "userRole", width: 20 },
    { header: "Target Entity", key: "entity", width: 20 },
    { header: "Entity ID", key: "entityId", width: 12 },
    { header: "IP Address", key: "ipAddress", width: 18 },
    { header: "Details", key: "details", width: 45 },
  ];

  for (const log of logs) {
    worksheet.addRow({
      id: log.id,
      createdAt: safeFormatDate(log.createdAt),
      action: log.action,
      actor: resolveActorName(log),
      userRole: log.user?.role || "N/A",
      entity: log.entity || "N/A",
      entityId: log.entityId || "N/A",
      details: log.details || "",
    });
  }

  // Format header row
  worksheet.getRow(1).font = { bold: true };

  const buffer = await workbook.csv.writeBuffer();

  await logAudit(
    requestedBy.id,
    "SECURITY_AUDIT_REPORT_EXPORT_CSV",
    "AuditLog",
    null,
    {
      recordsCount: logs.length,
      filters: filters || {},
    }
  );

  return Buffer.from(buffer);
};