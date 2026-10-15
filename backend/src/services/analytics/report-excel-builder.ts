import ExcelJS from "exceljs";
import { ReportMetadata } from "./report-theme.js";

export interface ExcelColumnDef {
  header: string;
  key: string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
}

export function createHRExcelWorkbook(meta: ReportMetadata, sheetName: string): {
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
} {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MEGS Recruitment Management System";
  workbook.lastModifiedBy = meta.requestedByEmail;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = meta.reportTitle;
  workbook.subject = `${meta.reportTitle} - ${meta.documentCode}`;
  workbook.company = "MAR Employment and Services (MEGS)";

  const cleanSheetName = sheetName.replace(/[\\/*?[\]:]/g, " ").slice(0, 31);
  const worksheet = workbook.addWorksheet(cleanSheetName, {
    views: [{ showGridLines: true, state: "frozen", ySplit: 7 }],
    properties: { defaultRowHeight: 20 },
  });

  return { workbook, worksheet };
}

export function applySpreadsheetHeaderBlock(worksheet: ExcelJS.Worksheet, meta: ReportMetadata): void {
  // Row 1: Title Header Banner
  worksheet.mergeCells("A1:H1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = meta.reportTitle;
  titleCell.font = { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate 900
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  worksheet.getRow(1).height = 28;

  // Row 2: Agency & Division
  worksheet.mergeCells("A2:H2");
  const orgCell = worksheet.getCell("A2");
  orgCell.value = `${meta.organization} • ${meta.division}`;
  orgCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF334155" } };
  orgCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }, // Slate 100
  };
  orgCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  worksheet.getRow(2).height = 20;

  // Each details line is one merged cell across the whole banner, so it never depends on the width of the table
  // columns below it and nothing gets cut off.
  const detailsLine = (rowNumber: number, pairs: [string, string][]) => {
    worksheet.mergeCells(`A${rowNumber}:H${rowNumber}`);
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
      fgColor: { argb: "FF1E293B" }, // Slate 800
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
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
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

      cell.value = val !== undefined && val !== null && val !== "" ? val : "—";
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
        fgColor: { argb: isZebra ? "FFF8FAFC" : "FFFFFFFF" },
      };

      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
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
