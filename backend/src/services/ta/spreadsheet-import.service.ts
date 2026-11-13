// Excel import for the batch "Load clients / requests" screens: a fixed .xlsx template, one row per record, no AI.
// Row 1 holds the field keys, row 2 the readable titles, row 3 an example. Each filled row goes through the same
// mapper the document readers use, so the review table treats it like any other read file. Formulas are never evaluated.
import type ExcelJS from "exceljs";
import type { Response } from "express";
import { CLIENT_FIELD_KEYS, MRF_FIELD_KEYS } from "../../utils/gemini.js";
import { mapClientReading, type ClientReadResult } from "./client-read.service.js";
import { mapMRFReading, type MRFReadResult } from "./mrf-read.service.js";

export type ImportKind = "clients" | "requests";
export type ImportRow<T> = T & { rowNumber: number };

export const MAX_IMPORT_ROWS = 100;
// Sheets are scanned up to this row, so a workbook with a million styled rows cannot tie the server up.
const MAX_SCANNED_ROWS = 5_000;
const MAX_CELL_CHARS = 5_000;

export class SpreadsheetImportError extends Error {}

const CLIENT_TITLES: Record<string, string> = {
  name: "Company name", tradeName: "Trade name", industry: "Industry", contactFirstName: "Contact first name",
  contactLastName: "Contact last name", contactEmail: "Contact email", contactPhone: "Contact mobile number",
  street: "Street", barangay: "Barangay", city: "City or municipality", province: "Province", postalCode: "Postal code",
};
const CLIENT_EXAMPLE: Record<string, string> = {
  name: "Example Company Inc.", tradeName: "Example Co", industry: "Manufacturing", contactFirstName: "Juan",
  contactLastName: "Dela Cruz", contactEmail: "juan@example.com", contactPhone: "09171234567",
  street: "123 Example Street", barangay: "Poblacion", city: "Makati", province: "Metro Manila", postalCode: "1200",
};

const MRF_TITLES: Record<string, string> = {
  title: "Position", description: "Job description", headcount: "Workers needed", location: "Work location",
  targetFillDate: "Needed by (YYYY-MM-DD)", priority: "Priority (LOW, NORMAL, HIGH, URGENT)",
  employmentType: "Employment type", workArrangement: "Work arrangement (On-site, Remote, Hybrid)",
  requiredSkills: "Required skills (comma-separated)", requiredExperience: "Required experience",
  requiredEducation: "Required education", requiredCertifications: "Required certifications (comma-separated)",
  salaryRangeMin: "Monthly salary from", salaryRangeMax: "Monthly salary to", ageMin: "Minimum age", ageMax: "Maximum age",
  genderPreference: "Gender (ANY, MALE, FEMALE)", tattooPolicy: "Tattoos (ALLOWED, NO_VISIBLE, NONE)",
  department: "Department", workShift: "Work shift", workDays: "Work days", workHoursPerDay: "Hours per day",
  workTime: "Work time", requestReason: "Reason for request", requestReasonNote: "Reason note",
};
const MRF_EXAMPLE: Record<string, string> = {
  title: "Production Operator", description: "Operates machines on the production line.", headcount: "10",
  location: "Makati City", targetFillDate: "2027-01-31", priority: "NORMAL", employmentType: "Contractual",
  workArrangement: "On-site", requiredSkills: "Machine operation, Teamwork", requiredExperience: "6 months",
  requiredEducation: "High school graduate", requiredCertifications: "", salaryRangeMin: "15000", salaryRangeMax: "18000",
  ageMin: "18", ageMax: "40", genderPreference: "ANY", tattooPolicy: "ALLOWED", department: "Production",
  workShift: "", workDays: "", workHoursPerDay: "8", workTime: "8:00 AM - 5:00 PM", requestReason: "", requestReasonNote: "",
};

const SHEETS = {
  clients: { keys: CLIENT_FIELD_KEYS as readonly string[], titles: CLIENT_TITLES, example: CLIENT_EXAMPLE, sheet: "Clients" },
  requests: { keys: MRF_FIELD_KEYS as readonly string[], titles: MRF_TITLES, example: MRF_EXAMPLE, sheet: "Requests" },
} as const;

export const importTemplateFileName = (kind: ImportKind): string => `MEGS-${kind}-template.xlsx`;

export async function buildImportTemplate(kind: ImportKind): Promise<Buffer> {
  const spec = SHEETS[kind];
  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = "MEGS Recruitment Management System";
  const sheet = workbook.addWorksheet(spec.sheet);
  sheet.addRow([...spec.keys]);
  sheet.addRow(spec.keys.map((key) => spec.titles[key] ?? key));
  sheet.addRow(spec.keys.map((key) => spec.example[key] ?? ""));
  sheet.getRow(1).font = { color: { argb: "FF64748B" }, size: 9 };
  sheet.getRow(2).font = { bold: true };
  sheet.getRow(3).font = { italic: true, color: { argb: "FF64748B" } };
  sheet.columns.forEach((column) => { column.width = 24; });
  // Everything is text, so phone numbers keep their leading zero and dates stay as typed.
  sheet.columns.forEach((column) => { column.style = { numFmt: "@" }; });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export const sendXlsx = (res: Response, fileName: string, buffer: Buffer): void => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
};

const pad =(n: number) => String(n).padStart(2, "0");

/** A cell as plain trimmed text. Rich text, hyperlinks and formulas use what the cell shows; dates become YYYY-MM-DD. */
export function cellText(value: unknown): string {
  let text = "";
  if (value === null || value === undefined) text = "";
  else if (typeof value === "string") text = value;
  else if (typeof value === "number") text = Number.isFinite(value) ? String(value) : "";
  else if (value instanceof Date) text = Number.isNaN(value.getTime()) ? "" : `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  else if (typeof value === "object") {
    const cell = value as { richText?: Array<{ text?: unknown }>; text?: unknown; result?: unknown; error?: unknown };
    if (Array.isArray(cell.richText)) text = cell.richText.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
    else if ("result" in cell) text = cell.error ? "" : cellText(cell.result);
    else if ("text" in cell) text = cellText(cell.text);
  }
  return text.trim().slice(0, MAX_CELL_CHARS);
}

const sameCells = (a: string[], b: string[]): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

/** Reads the first sheet of an .xlsx into one raw key/value object per filled row. */
export async function readImportRows(buffer: Buffer, kind: ImportKind): Promise<Array<{ rowNumber: number; raw: Record<string, string> }>> {
  const spec = SHEETS[kind];
  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  try { await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer); }
  catch { throw new SpreadsheetImportError("This file could not be read. Download the template and fill it in."); }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new SpreadsheetImportError("This file has no sheet. Download the template and fill it in.");
  if (sheet.rowCount > MAX_SCANNED_ROWS) throw new SpreadsheetImportError(`This file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);

  const known = new Map(spec.keys.map((key) => [key.toLowerCase(), key]));
  const columns: Array<{ index: number; key: string }> = [];
  sheet.getRow(1).eachCell((cell, index) => {
    const key = known.get(cellText(cell.value).toLowerCase());
    if (key && !columns.some((column) => column.key === key)) columns.push({ index, key });
  });
  if (!columns.length) throw new SpreadsheetImportError("This file does not match the template. Download the template and fill it in.");

  const rowTexts = (rowNumber: number) => columns.map(({ index }) => cellText(sheet.getRow(rowNumber).getCell(index).value));
  const titles = columns.map(({ key }) => spec.titles[key] ?? key);
  const example = columns.map(({ key }) => spec.example[key] ?? "");

  const rows: Array<{ rowNumber: number; raw: Record<string, string> }> = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const texts = rowTexts(rowNumber);
    if (texts.every((text) => !text)) continue;
    if (rowNumber === 2 && sameCells(texts, titles)) continue;
    if (rowNumber === 3 && sameCells(texts, example)) continue;
    if (rows.length >= MAX_IMPORT_ROWS) throw new SpreadsheetImportError(`This file has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);
    const raw: Record<string, string> = {};
    columns.forEach(({ key }, i) => { if (texts[i]) raw[key] = texts[i]!; });
    rows.push({ rowNumber, raw });
  }
  return rows;
}

export async function importClientRows(buffer: Buffer): Promise<Array<ImportRow<ClientReadResult>>> {
  return (await readImportRows(buffer, "clients")).map(({ rowNumber, raw }) => ({ rowNumber, ...mapClientReading(raw) }));
}

export async function importRequestRows(buffer: Buffer): Promise<Array<ImportRow<MRFReadResult>>> {
  return (await readImportRows(buffer, "requests")).map(({ rowNumber, raw }) => ({ rowNumber, ...mapMRFReading(raw) }));
}
