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

  const cleanSheetName = sheetName.replace(/[\\/*?[\]:]/g, " ").slice(0, 31);
  const worksheet = workbook.addWorksheet(cleanSheetName, {
    views: [{ showGridLines: true, state: "frozen", ySplit: 7 }],
    properties: { defaultRowHeight: 20 },
  });

  return { workbook, worksheet };
}

const colLetter = (n: number): string => {
  let out = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) out = String.fromCharCode(65 + ((x - 1) % 26)) + out;
  return out;
};

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

// One embedded copy of the logo per workbook, shared by every sheet, so the file does not grow by 60 KB per sheet.
const logoIds = new WeakMap<ExcelJS.Workbook, number>();

/** Prints the MEGS logo in the top-left of a sheet, sized in pixels. No-op when the logo file is missing. */
function placeLogo(worksheet: ExcelJS.Worksheet, heightPx: number): void {
  if (!fs.existsSync(BRAND_LOGO_PATH)) return;
  let id = logoIds.get(worksheet.workbook);
  if (id === undefined) {
    id = worksheet.workbook.addImage({ buffer: fs.readFileSync(BRAND_LOGO_PATH) as any, extension: "jpeg" });
    logoIds.set(worksheet.workbook, id);
  }
  // The logo is 960x696, so the width follows the height.
  worksheet.addImage(id, { tl: { col: 0.05, row: 0.05 }, ext: { width: Math.round(heightPx * (960 / 696)), height: heightPx }, editAs: "oneCell" });
}

const PAGE_SETUP = (headerRow: number): Partial<ExcelJS.PageSetup> => ({
  orientation: "landscape",
  paperSize: 9,
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  printTitlesRow: `${headerRow}:${headerRow}`,
});

/**
 * Compact branded banner for the extra sheets of a workbook: company name, sheet title and one note line.
 * Occupies rows 1-3, so the table header goes in row 4.
 */
export function applySectionSheetHeader(
  worksheet: ExcelJS.Worksheet,
  meta: ReportMetadata,
  title: string,
  note: string,
  columnCount: number
): void {
  const width = Math.max(columnCount, 5);
  const last = colLetter(width);
  const hasLogo = fs.existsSync(BRAND_LOGO_PATH);
  const indent = hasLogo ? 9 : 1;

  worksheet.mergeCells(`A1:${last}1`);
  const orgCell = worksheet.getCell("A1");
  orgCell.value = `${meta.organization}  •  ${meta.reportTitle}`;
  orgCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  orgCell.alignment = { vertical: "bottom", horizontal: "left", indent };
  worksheet.getRow(1).height = 20;

  worksheet.mergeCells(`A2:${last}2`);
  const titleCell = worksheet.getCell("A2");
  titleCell.value = title;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: BRAND_ARGB.navy } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent };
  worksheet.getRow(2).height = 28;
  for (let c = 1; c <= width; c++) {
    worksheet.getCell(2, c).border = { bottom: { style: "thick", color: { argb: BRAND_ARGB.red } } };
  }
  placeLogo(worksheet, 58);

  worksheet.mergeCells(`A3:${last}3`);
  const noteCell = worksheet.getCell("A3");
  noteCell.value = note;
  noteCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF475569" } };
  noteCell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  worksheet.getRow(3).height = note.length > 140 ? 30 : 20;
  worksheet.pageSetup = PAGE_SETUP(4);
}

export function applySpreadsheetHeaderBlock(worksheet: ExcelJS.Worksheet, meta: ReportMetadata, columnCount = 8): void {
  const last = colLetter(Math.max(columnCount, 5));
  const width = Math.max(columnCount, 5);

  // Rows 1-2: logo on the left, report title and company name beside it, a red rule underneath.
  const hasLogo = fs.existsSync(BRAND_LOGO_PATH);
  const indent = hasLogo ? 11 : 1;
  worksheet.mergeCells(`A1:${last}1`);
  const titleCell = worksheet.getCell("A1");
  titleCell.value = meta.reportTitle;
  titleCell.font = { name: "Arial", size: 16, bold: true, color: { argb: BRAND_ARGB.navy } };
  titleCell.alignment = { vertical: "bottom", horizontal: "left", indent };
  worksheet.getRow(1).height = 34;

  worksheet.mergeCells(`A2:${last}2`);
  const orgCell = worksheet.getCell("A2");
  orgCell.value = `${meta.organization}  •  ${meta.division}`;
  orgCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  orgCell.alignment = { vertical: "top", horizontal: "left", indent };
  worksheet.getRow(2).height = 22;
  for (let c = 1; c <= width; c++) {
    worksheet.getCell(2, c).border = { bottom: { style: "thick", color: { argb: BRAND_ARGB.red } } };
  }
  placeLogo(worksheet, 64);

  // Each details line is one merged cell across the whole banner, so it never depends on the width of the table
  // columns below it and nothing gets cut off.
  const detailsLine = (rowNumber: number, pairs: [string, string][]) => {
    worksheet.mergeCells(`A${rowNumber}:${last}${rowNumber}`);
    const cell = worksheet.getCell(`A${rowNumber}`);
    const font = { name: "Arial", size: 9 };
    cell.value = {
      richText: pairs.flatMap(([label, value], i) => [
        { text: `${i > 0 ? "     " : ""}${label} `, font: { ...font, bold: true, color: { argb: "FF475569" } } },
        { text: value, font: { ...font, color: { argb: "FF0F172A" } } },
      ]),
    };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
    const length = pairs.reduce((sum, [l, v]) => sum + l.length + v.length + 6, 0);
    worksheet.getRow(rowNumber).height = length > 170 ? 32 : 18;
  };

  detailsLine(3, [
    ["Report no.:", meta.documentCode],
    ["Created on:", meta.generatedAtFormatted],
    ["Prepared for:", meta.roleBadge],
    ["Privacy:", meta.classification],
  ]);
  detailsLine(4, [
    ["Created by:", meta.requestedByEmail],
    ["Showing:", meta.filterSummary],
  ]);

  // Rows 5 & 6 are clean blank buffer rows
  worksheet.getRow(5).height = 8;
  worksheet.getRow(6).height = 8;
  worksheet.pageSetup = PAGE_SETUP(7);
}

export function applyTableHeaders(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  columns: ExcelColumnDef[]
): void {
  const row = worksheet.getRow(headerRowIndex);
  row.height = 30;

  columns.forEach((col, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: BRAND_ARGB.navy },
    };
    // Headers are never right-aligned: the filter button sits on the right edge and would cover the text.
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align === "right" ? "left" : col.align || "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF94A3B8" } },
      left: { style: "thin", color: { argb: "FF94A3B8" } },
      bottom: { style: "medium", color: { argb: BRAND_ARGB.red } },
      right: { style: "thin", color: { argb: "FF94A3B8" } },
    };
  });

  // Enable AutoFilter and frozen split
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: columns.length },
  };

  worksheet.views = [{ showGridLines: true, state: "frozen", ySplit: headerRowIndex }];
}

export function applyDataRowsAndFormatting(
  worksheet: ExcelJS.Worksheet,
  headerRowIndex: number,
  columns: ExcelColumnDef[],
  rows: Record<string, any>[]
): void {
  // Bold header text plus room for the filter button, so a short heading like "Number" is never covered.
  const colLengths: number[] = columns.map((col) => Math.ceil(col.header.length * 1.2) + 3);

  rows.forEach((rowData, rowIndex) => {
    const currentRowNumber = headerRowIndex + 1 + rowIndex;
    const row = worksheet.getRow(currentRowNumber);
    const isZebra = rowIndex % 2 === 1;

    columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      const val = rowData[col.key];

      const empty = val === undefined || val === null || val === "";
      // Number columns keep a truly empty cell so they still sort, filter and sum as numbers; text columns show a dash.
      cell.value = empty ? (col.align === "right" ? null : "—") : val;
      cell.font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };
      // Long text wraps onto more lines in the cell instead of being hidden behind the next column.
      cell.alignment = {
        vertical: "top",
        horizontal: col.align || "left",
        wrapText: true,
      };

      if (col.numFmt) {
        cell.numFmt = col.numFmt;
      }

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isZebra ? BRAND_ARGB.zebra : "FFFFFFFF" },
      };

      cell.border = {
        top: { style: "thin", color: { argb: BRAND_ARGB.line } },
        left: { style: "thin", color: { argb: BRAND_ARGB.line } },
        bottom: { style: "thin", color: { argb: BRAND_ARGB.line } },
        right: { style: "thin", color: { argb: BRAND_ARGB.line } },
      };

      const strLen = String(cell.value || "").length;
      if (strLen > colLengths[colIdx]) {
        colLengths[colIdx] = strLen;
      }
    });
  });

  // Auto-fit column widths with minimum bounds
  columns.forEach((col, colIdx) => {
    const calculatedWidth = Math.max(colLengths[colIdx] + 4, col.minWidth || 14);
    worksheet.getColumn(colIdx + 1).width = Math.min(calculatedWidth, 48);
  });

  // Make each row tall enough for its wrapped text, so no line is cut off in any spreadsheet app.
  rows.forEach((rowData, rowIndex) => {
    const lines = Math.max(
      1,
      ...columns.map((col, colIdx) => {
        const text = String(rowData[col.key] ?? "");
        const perLine = Math.max(1, (worksheet.getColumn(colIdx + 1).width ?? 14) - 2);
        return Math.ceil(text.length / perLine);
      })
    );
    worksheet.getRow(headerRowIndex + 1 + rowIndex).height = Math.max(20, lines * 12 + 6);
  });
}

export async function writeWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
