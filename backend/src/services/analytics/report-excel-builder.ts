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

  // Row 3: Meta Key-Values
  const r3 = worksheet.getRow(3);
  r3.height = 18;
  r3.getCell(1).value = "Document Ref:";
  r3.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r3.getCell(2).value = meta.documentCode;
  r3.getCell(2).font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };

  r3.getCell(3).value = "Date Generated:";
  r3.getCell(3).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r3.getCell(4).value = meta.generatedAtFormatted;
  r3.getCell(4).font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };

  r3.getCell(5).value = "Classification:";
  r3.getCell(5).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r3.getCell(6).value = meta.classification;
  r3.getCell(6).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F766E" } };

  // Row 4: Officer & Filter Info
  const r4 = worksheet.getRow(4);
  r4.height = 18;
  r4.getCell(1).value = "Officer / User:";
  r4.getCell(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r4.getCell(2).value = meta.requestedByEmail;
  r4.getCell(2).font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };

  r4.getCell(3).value = "Filter Scope:";
  r4.getCell(3).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r4.getCell(4).value = meta.filterSummary;
  r4.getCell(4).font = { name: "Arial", size: 9, color: { argb: "FF334155" } };

  r4.getCell(5).value = "Role Context:";
  r4.getCell(5).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF475569" } };
  r4.getCell(6).value = meta.roleBadge;
  r4.getCell(6).font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };

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
  row.height = 24;

  columns.forEach((col, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate 800
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: col.align || "left",
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
  const colLengths: number[] = columns.map((col) => col.header.length);

  rows.forEach((rowData, rowIndex) => {
    const currentRowNumber = headerRowIndex + 1 + rowIndex;
    const row = worksheet.getRow(currentRowNumber);
    row.height = 20;
    const isZebra = rowIndex % 2 === 1;

    columns.forEach((col, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      const val = rowData[col.key];

      cell.value = val !== undefined && val !== null ? val : "N/A";
      cell.font = { name: "Arial", size: 9, color: { argb: "FF0F172A" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: col.align || "left",
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
}

export async function writeWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
