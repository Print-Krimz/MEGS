import fs from "fs";
import type ExcelJS from "exceljs";
import { BRAND_ARGB, BRAND_LOGO_PATH, ReportMetadata } from "./report-theme.js";

export interface ExcelColumnDef {
  header: string;
  key: string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
}

const FONT = "Arial";
const INK = "FF0F172A";
const MUTED = "FF475569";

export async function createHRExcelWorkbook(meta: ReportMetadata, sheetName: string): Promise<{
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
}> {
  // Loaded on first export so exceljs stays out of server boot memory.
  const { default: ExcelJSRuntime } = await import("exceljs");
  const workbook = new ExcelJSRuntime.Workbook();
  workbook.creator = "MEGS Recruitment Management System";
  workbook.lastModifiedBy = meta.requestedByEmail;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = meta.reportTitle;
  workbook.subject = `${meta.reportTitle} - ${meta.documentCode}`;
  workbook.company = meta.organization;

  return { workbook, worksheet: addSheet(workbook, sheetName) };
}

/** A sheet with gridlines off: the table draws its own thin row lines, so there is only one set of lines to look at. */
export function addSheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const clean = name.replace(/[\\/*?[\]:]/g, " ").slice(0, 31);
  return workbook.addWorksheet(clean, { views: [{ showGridLines: false }], properties: { defaultRowHeight: 20 } });
}

const colLetter = (n: number): string => {
  let out = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out;
  return out;
};

const solid = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const hairline = { style: "thin" as const, color: { argb: BRAND_ARGB.line } };

// One embedded copy of the logo per workbook, shared by every sheet, so the file does not grow by 60 KB per sheet.
const logoIds = new WeakMap<ExcelJS.Workbook, number>();

/** Puts the MEGS logo at the top-left of a sheet. Returns false when the logo file is missing. */
function placeLogo(worksheet: ExcelJS.Worksheet, heightPx: number): boolean {
  if (!fs.existsSync(BRAND_LOGO_PATH)) return false;
  let id = logoIds.get(worksheet.workbook);
  if (id === undefined) {
    id = worksheet.workbook.addImage({ buffer: fs.readFileSync(BRAND_LOGO_PATH) as any, extension: "jpeg" });
    logoIds.set(worksheet.workbook, id);
  }
  // The logo is 960x696, so the width follows the height.
  worksheet.addImage(id, { tl: { col: 0.05, row: 0.1 }, ext: { width: Math.round(heightPx * (960 / 696)), height: heightPx }, editAs: "oneCell" });
  return true;
}

/** Print setup shared by every sheet: landscape, one page wide, header row repeated, company and page number in the margins. */
function printSetup(worksheet: ExcelJS.Worksheet, meta: ReportMetadata, headerRow?: number): void {
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    ...(headerRow ? { printTitlesRow: `${headerRow}:${headerRow}` } : {}),
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
  worksheet.headerFooter = {
    oddHeader: `&L&"Arial,Bold"&9${meta.organization}&R&"Arial,Regular"&9${meta.reportTitle}`,
    oddFooter: `&L&"Arial,Regular"&8${meta.classification}&R&"Arial,Regular"&8Page &P of &N`,
  };
}

/**
 * Report details laid out as a simple label / value list: logo, title, company, then Report no., Created on, Prepared for,
 * Created by, Showing and Privacy. Values are merged across `valueColumns` columns (B onward) so long filter text wraps
 * inside the list instead of spilling. Returns the first free row below the list.
 */
export function applyReportInfoBlock(worksheet: ExcelJS.Worksheet, meta: ReportMetadata, valueColumns = 4): number {
  const lastCol = colLetter(1 + Math.max(1, valueColumns));

  // Row 1 holds only the logo, so nothing can overlap it.
  const hasLogo = placeLogo(worksheet, 62);
  worksheet.getRow(1).height = hasLogo ? 52 : 6;

  worksheet.mergeCells(`A2:${lastCol}2`);
  const title = worksheet.getCell("A2");
  title.value = meta.reportTitle;
  title.font = { name: FONT, size: 18, bold: true, color: { argb: BRAND_ARGB.navy } };
  title.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(2).height = 30;

  worksheet.mergeCells(`A3:${lastCol}3`);
  const org = worksheet.getCell("A3");
  org.value = `${meta.organization}  •  ${meta.division}`;
  org.font = { name: FONT, size: 10, color: { argb: MUTED } };
  org.alignment = { vertical: "top", horizontal: "left" };
  worksheet.getRow(3).height = 22;
  for (let c = 1; c <= 1 + Math.max(1, valueColumns); c++) {
    worksheet.getCell(3, c).border = { bottom: { style: "medium", color: { argb: BRAND_ARGB.red } } };
  }

  const details: [string, string][] = [
    ["Report no.", meta.documentCode],
    ["Created on", meta.generatedAtFormatted],
    ["Prepared for", meta.roleBadge],
    ["Created by", meta.requestedByEmail],
    ["Showing", meta.filterSummary],
    ["Privacy", meta.classification],
  ];
  let row = 5;
  for (const [label, value] of details) {
    worksheet.mergeCells(`B${row}:${lastCol}${row}`);
    const l = worksheet.getCell(`A${row}`);
    l.value = label;
    l.font = { name: FONT, size: 10, bold: true, color: { argb: MUTED } };
    l.alignment = { vertical: "top", horizontal: "left" };
    const v = worksheet.getCell(`B${row}`);
    v.value = value;
    v.font = { name: FONT, size: 10, color: { argb: INK } };
    v.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    worksheet.getRow(row).height = value.length > 110 ? 34 : 20;
    row++;
  }
  worksheet.views = [{ showGridLines: false }];
  return row + 1;
}

/**
 * Compact heading for a data sheet: title (with a red rule under it) and one note line. Occupies rows 1-2, so the table
 * header goes in the returned row (3). Only these rows and the table header stay frozen, so the data keeps the screen.
 */
export function applySectionSheetHeader(
  worksheet: ExcelJS.Worksheet,
  meta: ReportMetadata,
  title: string,
  note: string,
  columnCount: number
): number {
  const width = Math.max(columnCount, 4);
  const last = colLetter(width);

  worksheet.mergeCells(`A1:${last}1`);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { name: FONT, size: 14, bold: true, color: { argb: BRAND_ARGB.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 30;
  for (let c = 1; c <= width; c++) {
    worksheet.getCell(1, c).border = { bottom: { style: "medium", color: { argb: BRAND_ARGB.red } } };
  }

  worksheet.mergeCells(`A2:${last}2`);
  const noteCell = worksheet.getCell("A2");
  noteCell.value = note;
  noteCell.font = { name: FONT, size: 9, italic: true, color: { argb: MUTED } };
  noteCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  worksheet.getRow(2).height = note.length > 150 ? 32 : 20;

  printSetup(worksheet, meta, 3);
  return 3;
}

export function applyTableHeaders(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  columns: ExcelColumnDef[],
  options: { freeze?: boolean } = {}
): void {
  const row = worksheet.getRow(headerRowIndex);
  row.height = 28;

  columns.forEach((col, idx) => {
    const cell = row.getCell(idx + 1);
    const align = col.align || "left";
    cell.value = col.header;
    cell.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = solid(BRAND_ARGB.navy);
    // Same alignment as the data underneath. The extra indent keeps the filter button off the text.
    cell.alignment = { vertical: "middle", horizontal: align, wrapText: true, indent: align === "left" ? 1 : 2 };
  });

  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  worksheet.views = [
    options.freeze === false
      ? { showGridLines: false }
      : { showGridLines: false, state: "frozen", ySplit: headerRowIndex },
  ];
}

export function applyDataRowsAndFormatting(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  columns: ExcelColumnDef[],
  rows: Record<string, any>[]
): void {
  // Header text is bold and needs room for the filter button, so a short heading like "Number" is never covered.
  const colLengths: number[] = columns.map((col) => Math.ceil(col.header.length * 1.2) + 4);

  rows.forEach((rowData, rowIndex) => {
    const row = worksheet.getRow(headerRowIndex + 1 + rowIndex);

    columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      const val = rowData[col.key];
      const empty = val === undefined || val === null || val === "";
      const align = col.align || "left";
      // Number columns keep a truly empty cell so they still sort, filter and sum as numbers; text columns show a dash.
      cell.value = empty ? (col.align === "right" ? null : "—") : val;
      cell.font = { name: FONT, size: 10, color: { argb: INK } };
      // Everything sits in the middle of the row so a one-line value lines up with its wrapped neighbours.
      cell.alignment = { vertical: "middle", horizontal: align, wrapText: true, indent: align === "center" ? 0 : 1 };
      if (col.numFmt) cell.numFmt = col.numFmt;
      // One thin line under each row, nothing else: no side borders, no stripes.
      cell.border = { bottom: hairline };

      const strLen = String(cell.value ?? "").length;
      if (strLen > colLengths[colIdx]) colLengths[colIdx] = strLen;
    });
  });

  columns.forEach((col, colIdx) => {
    const calculatedWidth = Math.max(colLengths[colIdx] + 4, col.minWidth || 14);
    worksheet.getColumn(colIdx + 1).width = Math.min(calculatedWidth, 48);
  });

  // Each row is tall enough for its wrapped text, so no line is cut off in any spreadsheet app.
  rows.forEach((rowData, rowIndex) => {
    const lines = Math.max(
      1,
      ...columns.map((col, colIdx) => {
        const text = String(rowData[col.key] ?? "");
        const perLine = Math.max(1, (worksheet.getColumn(colIdx + 1).width ?? 14) - 4);
        return Math.ceil(text.length / perLine);
      })
    );
    worksheet.getRow(headerRowIndex + 1 + rowIndex).height = Math.max(22, lines * 13 + 9);
  });
}

/** Print setup for a sheet whose table header is at `headerRow`. Used by sheets that build their own heading. */
export function applyPrintSetup(worksheet: ExcelJS.Worksheet, meta: ReportMetadata, headerRow?: number): void {
  printSetup(worksheet, meta, headerRow);
}

export async function writeWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
