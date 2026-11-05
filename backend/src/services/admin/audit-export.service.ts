import { resolveUserName } from "../../utils/user-name.js";
import { auditCategoryOf, fetchAuditLogs } from "./admin.service.js";
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

/**
 * What an audit export contains. Only plain facts a manager can read: when, what kind of event, what happened, who did it,
 * and which kind of record it touched. The IP address, the raw details and internal ids stay in the audit log itself
 * (the Audit Logs page) and are never written to a downloaded file.
 */
const AUDIT_HEADERS = ["Date and time (PHT)", "Category", "Action", "Performed by", "Role", "Record"] as const;

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: "Admin",
  TALENT_ACQUISITION: "Recruiter",
  APPLICANT: "Applicant",
};

const PHT_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Manila",
});

const formatWhen = (date: Date | string | null | undefined): string => {
  if (!date) return "Not recorded";
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? "Not recorded" : PHT_FORMAT.format(d);
};

/** USER_LOGGED_IN -> "User logged in". MFA stays upper case. */
export const humanizeAction = (code: string | null | undefined): string => {
  if (!code) return "System action";
  const words = code
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => (w === "mfa" ? "MFA" : w === "ta" ? "recruiter" : w));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const humanizeEntity = (entity: string | null | undefined): string => {
  if (!entity) return "Not applicable";
  return entity.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
};

interface AuditRow {
  when: string;
  category: string;
  action: string;
  actor: string;
  role: string;
  record: string;
}

export const toAuditRow = (log: any): AuditRow => ({
  when: formatWhen(log.createdAt),
  category: auditCategoryOf(log.action),
  action: humanizeAction(log.action),
  actor: log.user ? resolveUserName(log.user, "System") : "System",
  role: ROLE_LABELS[log.user?.role] ?? "System",
  record: humanizeEntity(log.entity),
});

const rowValues = (r: AuditRow): string[] => [r.when, r.category, r.action, r.actor, r.role, r.record];

const buildAuditFilterSummary = (filters?: any): string => {
  const parts: string[] = [];
  if (filters?.category) parts.push(`Category: ${filters.category}`);
  if (filters?.action) parts.push(`Action: ${humanizeAction(filters.action)}`);
  if (filters?.entity) parts.push(`Record: ${humanizeEntity(filters.entity)}`);
  if (filters?.search) parts.push(`Search: "${filters.search}"`);
  if (filters?.startDate && filters?.endDate) parts.push(`Dates: ${filters.startDate} to ${filters.endDate}`);
  else if (filters?.startDate) parts.push(`From: ${filters.startDate}`);
  else if (filters?.endDate) parts.push(`Up to: ${filters.endDate}`);
  return parts.length > 0 ? parts.join("  |  ") : "All activity";
};

const loadLogs = (filters: any, defaultLimit: number) =>
  fetchAuditLogs({
    ...filters,
    limit: filters?.limit ? parseInt(String(filters.limit), 10) : defaultLimit,
  });

const metaFor = (requestedBy: { email: string }, filters?: any) =>
  getReportMetadata({
    reportType: "AUDIT",
    roleScope: "ADMINISTRATOR",
    requestedByEmail: requestedBy.email,
    filterSummary: buildAuditFilterSummary(filters),
  });

const recordExport = (requestedBy: { id: string }, action: string, count: number, filters?: any) =>
  logAudit(requestedBy.id, action, "AuditLog", null, { recordsCount: count, filters: filters || {} });

export const generateAuditReportPDF = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await loadLogs(filters, 500);
  const meta = metaFor(requestedBy, filters);

  const doc = await createHRDocument({ orientation: "landscape", meta });
  renderCorporateHeader(doc, meta);

  const rows = logs.map(toAuditRow);
  renderSummaryKPIs(doc, [
    { label: "Events listed", value: rows.length },
    { label: "People involved", value: new Set(rows.map((r) => r.actor)).size },
    { label: "Sign-in and password events", value: rows.filter((r) => r.category === "Authentication").length },
    { label: "Account and setting changes", value: rows.filter((r) => r.category === "User Management" || r.category === "Configuration").length },
  ]);

  // Widths add up to the full landscape A4 content width (770pt).
  const columns: ColumnDef[] = [
    { header: AUDIT_HEADERS[0], width: 120, align: "center" },
    { header: AUDIT_HEADERS[1], width: 120, align: "left" },
    { header: AUDIT_HEADERS[2], width: 200, align: "left" },
    { header: AUDIT_HEADERS[3], width: 170, align: "left" },
    { header: AUDIT_HEADERS[4], width: 70, align: "center" },
    { header: AUDIT_HEADERS[5], width: 90, align: "left" },
  ];
  renderGridTable(doc, { columns, rows: rows.map(rowValues) });

  const buffer = await renderFootersAndPagination(doc, meta);
  recordExport(requestedBy, "SECURITY_AUDIT_REPORT_EXPORT_PDF", logs.length, filters).catch(() => null);
  return buffer;
};

export const generateAuditReportXLSX = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await loadLogs(filters, 2000);
  const meta = metaFor(requestedBy, filters);

  const { workbook, worksheet } = await createHRExcelWorkbook(meta, "Audit Trail");
  const columns: ExcelColumnDef[] = [
    { header: AUDIT_HEADERS[0], key: "when", minWidth: 22, align: "center" },
    { header: AUDIT_HEADERS[1], key: "category", minWidth: 18 },
    { header: AUDIT_HEADERS[2], key: "action", minWidth: 32 },
    { header: AUDIT_HEADERS[3], key: "actor", minWidth: 28 },
    { header: AUDIT_HEADERS[4], key: "role", minWidth: 14, align: "center" },
    { header: AUDIT_HEADERS[5], key: "record", minWidth: 20 },
  ];
  applySpreadsheetHeaderBlock(worksheet, meta, columns.length);
  applyTableHeaders(worksheet, 7, columns);
  applyDataRowsAndFormatting(worksheet, 7, columns, logs.map(toAuditRow) as unknown as Record<string, any>[]);

  const buffer = await writeWorkbookToBuffer(workbook);
  await recordExport(requestedBy, "SECURITY_AUDIT_REPORT_EXPORT_XLSX", logs.length, filters);
  return buffer;
};

const csvCell = (value: string): string => {
  // A cell that starts with = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const generateAuditReportCSV = async (
  requestedBy: { id: string; email: string },
  filters?: any
): Promise<Buffer> => {
  const logs = await loadLogs(filters, 5000);
  const lines = [AUDIT_HEADERS.join(","), ...logs.map((log: any) => rowValues(toAuditRow(log)).map(csvCell).join(","))];
  await recordExport(requestedBy, "SECURITY_AUDIT_REPORT_EXPORT_CSV", logs.length, filters);
  // The BOM makes Excel read the file as UTF-8.
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf-8");
};
