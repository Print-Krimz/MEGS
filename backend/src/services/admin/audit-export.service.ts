import { fetchAuditLogs } from "./admin.service.js";
import { logAudit } from "../../utils/audit.js";
import { getReportMetadata } from "../analytics/report-theme.js";
import {
  createHRDocument,
  renderCorporateHeader,
  renderSummaryKPIs,
  renderGridTable,
  renderFootersAndPagination,
  ColumnDef,
} from "../analytics/report-pdf-builder.js";
import {
  createHRExcelWorkbook,
  applySpreadsheetHeaderBlock,
  applyTableHeaders,
  applyDataRowsAndFormatting,
  writeWorkbookToBuffer,
  ExcelColumnDef,
} from "../analytics/report-excel-builder.js";
import ExcelJS from "exceljs";

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
  return "System Administrator";
};

const resolveDetailsSummary = (log: any): string => {
  if (!log.details) return "N/A";
  try {
    const parsed = typeof log.details === "string" ? JSON.parse(log.details) : log.details;
    if (typeof parsed === "object") {
      const parts: string[] = [];
      if (parsed.ip) parts.push(`IP: ${parsed.ip}`);
      if (parsed.target) parts.push(`Target: ${parsed.target}`);
      if (parsed.reason) parts.push(`Reason: ${parsed.reason}`);
      if (parsed.status) parts.push(`Status: ${parsed.status}`);
      return parts.length > 0 ? parts.join(", ") : JSON.stringify(parsed).slice(0, 40);
    }
    return String(parsed).slice(0, 40);
  } catch {
    return String(log.details).slice(0, 40);
  }
};

const buildAuditFilterSummary = (filters?: any): string => {
  if (!filters || Object.keys(filters).length === 0) return "All Audit Events (Unfiltered)";
  const parts: string[] = [];
  if (filters.action) parts.push(`Action: ${filters.action}`);
  if (filters.entity) parts.push(`Entity: ${filters.entity}`);
  if (filters.category) parts.push(`Category: ${filters.category}`);
  if (filters.search) parts.push(`Query: "${filters.search}"`);
  if (filters.startDate && filters.endDate) {
    parts.push(`Date: ${filters.startDate} to ${filters.endDate}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "All Audit Events";
};

export const generateAuditReportPDF = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await fetchAuditLogs({
    ...filters,
    limit: filters?.limit ? parseInt(String(filters.limit), 10) : 500,
  });

  const filterSummary = buildAuditFilterSummary(filters);
  const meta = getReportMetadata({
    reportType: "AUDIT",
    roleScope: "ADMINISTRATOR",
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const doc = createHRDocument({ orientation: "landscape" });
  renderCorporateHeader(doc, meta);

  // Compute summary KPI metrics
  const totalEvents = logs.length;
  const uniqueActors = new Set(logs.map((l: any) => l.userId || resolveActorName(l))).size;
  const authEvents = logs.filter((l: any) => (l.action || "").includes("LOGIN") || (l.action || "").includes("AUTH")).length;
  const adminEvents = logs.filter((l: any) => (l.action || "").includes("CONFIG") || (l.action || "").includes("BACKUP") || (l.action || "").includes("USER_ROLE")).length;

  renderSummaryKPIs(doc, [
    { label: "Total Audit Events", value: totalEvents },
    { label: "Distinct Actors", value: uniqueActors },
    { label: "Authentication Events", value: authEvents },
    { label: "Administrative Actions", value: adminEvents },
  ]);

  const columns: ColumnDef[] = [
    { header: "Log ID", width: 50, align: "center" },
    { header: "Timestamp (UTC)", width: 105, align: "center" },
    { header: "Action Taxonomy", width: 135, align: "left", badge: true },
    { header: "Acting User", width: 130, align: "left" },
    { header: "Actor Role", width: 90, align: "center" },
    { header: "Target Entity", width: 100, align: "left" },
    { header: "Client IP", width: 70, align: "center" },
    { header: "Context Details", width: 90, align: "left" },
  ];

  const rows = logs.map((log: any) => {
    const actor = resolveActorName(log);
    const target = log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ""}` : "N/A";
    let ip = "N/A";
    try {
      const details = typeof log.details === "string" ? JSON.parse(log.details) : log.details || {};
      ip = details.ip || details.ipAddress || "N/A";
    } catch {}

    return [
      `#${log.id}`,
      safeFormatDate(log.createdAt),
      log.action,
      actor,
      log.user?.role || "SYSTEM",
      target,
      ip,
      resolveDetailsSummary(log),
    ];
  });

  renderGridTable(doc, { columns, rows });

  const buffer = await renderFootersAndPagination(doc, meta);

  logAudit(
    requestedBy.id,
    "SECURITY_AUDIT_REPORT_EXPORT_PDF",
    "AuditLog",
    null,
    { recordsCount: logs.length, filters: filters || {} }
  ).catch(() => null);

  return buffer;
};

export const generateAuditReportXLSX = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await fetchAuditLogs({
    ...filters,
    limit: filters?.limit ? parseInt(String(filters.limit), 10) : 2000,
  });

  const filterSummary = buildAuditFilterSummary(filters);
  const meta = getReportMetadata({
    reportType: "AUDIT",
    roleScope: "ADMINISTRATOR",
    requestedByEmail: requestedBy.email,
    filterSummary,
  });

  const { workbook, worksheet } = createHRExcelWorkbook(meta, "Audit Trail");
  applySpreadsheetHeaderBlock(worksheet, meta);

  const columns: ExcelColumnDef[] = [
    { header: "Log ID", key: "id", minWidth: 12, align: "center" },
    { header: "Timestamp (UTC)", key: "createdAt", minWidth: 20, align: "center" },
    { header: "Action Taxonomy", key: "action", minWidth: 26 },
    { header: "Acting User", key: "actor", minWidth: 26 },
    { header: "Actor Role", key: "userRole", minWidth: 18, align: "center" },
    { header: "Target Entity", key: "entity", minWidth: 18 },
    { header: "Entity Record ID", key: "entityId", minWidth: 16, align: "center" },
    { header: "Client IP Address", key: "ipAddress", minWidth: 18, align: "center" },
    { header: "Audit Details", key: "details", minWidth: 35 },
  ];

  const rows = logs.map((log: any) => {
    let ip = "N/A";
    try {
      const details = typeof log.details === "string" ? JSON.parse(log.details) : log.details || {};
      ip = details.ip || details.ipAddress || "N/A";
    } catch {}

    return {
      id: log.id,
      createdAt: safeFormatDate(log.createdAt),
      action: log.action,
      actor: resolveActorName(log),
      userRole: log.user?.role || "SYSTEM",
      entity: log.entity || "N/A",
      entityId: log.entityId || "N/A",
      ipAddress: ip,
      details: typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details || ""),
    };
  });

  applyTableHeaders(worksheet, 7, columns);
  applyDataRowsAndFormatting(worksheet, 7, columns, rows);

  const buffer = await writeWorkbookToBuffer(workbook);

  await logAudit(
    requestedBy.id,
    "SECURITY_AUDIT_REPORT_EXPORT_XLSX",
    "AuditLog",
    null,
    { recordsCount: logs.length, filters: filters || {} }
  );

  return buffer;
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
    let ip = "N/A";
    try {
      const details = typeof log.details === "string" ? JSON.parse(log.details) : log.details || {};
      ip = details.ip || details.ipAddress || "N/A";
    } catch {}

    worksheet.addRow({
      id: log.id,
      createdAt: safeFormatDate(log.createdAt),
      action: log.action,
      actor: resolveActorName(log),
      userRole: log.user?.role || "N/A",
      entity: log.entity || "N/A",
      entityId: log.entityId || "N/A",
      ipAddress: ip,
      details: typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details || ""),
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