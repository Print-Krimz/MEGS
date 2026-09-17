import PDFDocument from "pdfkit";
import { HR_THEME, ReportMetadata, getStatusBadgeTheme } from "./report-theme.js";

export interface ColumnDef {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  badge?: boolean;
}

export interface TableDef {
  columns: ColumnDef[];
  rows: (string | number | null | undefined)[][];
  startY?: number;
}

export interface KPIItem {
  label: string;
  value: string | number;
  subtext?: string;
}

export interface CreateHRDocumentOptions {
  orientation?: "landscape" | "portrait";
}

/**
 * Instantiate an A4 PDFKit Document with buffered pages enabled for two-pass page numbering
 */
export function createHRDocument(options?: CreateHRDocumentOptions): PDFKit.PDFDocument {
  const layout = options?.orientation || "landscape";
  return new PDFDocument({
    size: "A4",
    layout,
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    bufferPages: true,
  });
}

/**
 * Render corporate executive letterhead, report title, classification, and metadata card
 */
export function renderCorporateHeader(doc: PDFKit.PDFDocument, meta: ReportMetadata): void {
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Top decorative corporate accent band
  doc.rect(margin, 30, contentWidth, 4).fill(HR_THEME.colors.accentTeal);

  // Agency branding
  doc.fontSize(10).font("Helvetica-Bold").fillColor(HR_THEME.colors.primaryNavy);
  doc.text(meta.organization, margin, 40);

  doc.fontSize(7.5).font("Helvetica").fillColor(HR_THEME.colors.textMuted);
  doc.text(meta.division, margin, 52);

  // Classification Badge (Top Right)
  const classText = meta.classification;
  doc.font("Helvetica-Bold").fontSize(7);
  const classWidth = doc.widthOfString(classText) + 14;
  const classX = margin + contentWidth - classWidth;
  doc.roundedRect(classX, 39, classWidth, 16, 2)
    .fillAndStroke(HR_THEME.colors.zebraRowFill, HR_THEME.colors.tableBorder);
  doc.fillColor(HR_THEME.colors.secondarySlate).text(classText, classX + 7, 44);

  // Document Title
  doc.moveDown(1.5);
  doc.fontSize(HR_THEME.fonts.titleSize).font("Helvetica-Bold").fillColor(HR_THEME.colors.primaryNavy);
  doc.text(meta.reportTitle, margin, 68);

  // Metadata Card Box
  const metaY = 88;
  const metaHeight = 44;
  doc.roundedRect(margin, metaY, contentWidth, metaHeight, 3)
    .fillAndStroke("#F8FAFC", HR_THEME.colors.tableBorder);

  const col1X = margin + 10;
  const col2X = margin + contentWidth * 0.35;
  const col3X = margin + contentWidth * 0.70;

  // Line 1
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(HR_THEME.colors.textSecondary);
  doc.text("DOCUMENT ID:", col1X, metaY + 7);
  doc.font("Helvetica").fillColor(HR_THEME.colors.primaryNavy);
  doc.text(meta.documentCode, col1X + 68, metaY + 7);

  doc.font("Helvetica-Bold").fillColor(HR_THEME.colors.textSecondary);
  doc.text("DATE & TIME:", col2X, metaY + 7);
  doc.font("Helvetica").fillColor(HR_THEME.colors.primaryNavy);
  doc.text(meta.generatedAtFormatted, col2X + 62, metaY + 7);

  doc.font("Helvetica-Bold").fillColor(HR_THEME.colors.textSecondary);
  doc.text("ROLE SCOPE:", col3X, metaY + 7);
  doc.font("Helvetica").fillColor(HR_THEME.colors.accentTeal);
  doc.text(meta.roleScope === "ADMINISTRATOR" ? "Administrator" : "Talent Acquisition", col3X + 58, metaY + 7);

  // Line 2
  doc.font("Helvetica-Bold").fillColor(HR_THEME.colors.textSecondary);
  doc.text("OFFICER:", col1X, metaY + 20);
  doc.font("Helvetica").fillColor(HR_THEME.colors.primaryNavy);
  doc.text(meta.requestedByEmail, col1X + 68, metaY + 20);

  doc.font("Helvetica-Bold").fillColor(HR_THEME.colors.textSecondary);
  doc.text("FILTER SCOPE:", col2X, metaY + 20);
  doc.font("Helvetica").fillColor(HR_THEME.colors.textSecondary);
  const truncatedFilters = meta.filterSummary.length > 70 ? meta.filterSummary.slice(0, 68) + "..." : meta.filterSummary;
  doc.text(truncatedFilters, col2X + 62, metaY + 20);

  // Bottom padding
  doc.y = metaY + metaHeight + 10;
}

/**
 * Render executive summary KPI metric cards
 */
export function renderSummaryKPIs(doc: PDFKit.PDFDocument, kpis: KPIItem[]): void {
  if (!kpis || kpis.length === 0) return;

  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startY = doc.y;
  const cardHeight = 34;
  const cardGap = 8;
  const count = Math.min(kpis.length, 5);
  const cardWidth = (contentWidth - (count - 1) * cardGap) / count;

  kpis.slice(0, count).forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + cardGap);
    doc.roundedRect(cardX, startY, cardWidth, cardHeight, 3)
      .fillAndStroke(HR_THEME.colors.kpiCardFill, HR_THEME.colors.kpiCardBorder);

    doc.font("Helvetica-Bold").fontSize(7).fillColor(HR_THEME.colors.textMuted);
    doc.text(kpi.label.toUpperCase(), cardX + 8, startY + 6, {
      width: cardWidth - 16,
      ellipsis: true,
    });

    doc.font("Helvetica-Bold").fontSize(12).fillColor(HR_THEME.colors.primaryNavy);
    doc.text(String(kpi.value), cardX + 8, startY + 16, {
      width: cardWidth - 16,
      ellipsis: true,
    });
  });

  doc.y = startY + cardHeight + 12;
}

/**
 * Render structured vector grid table with repeating headers on page breaks
 */
export function renderGridTable(doc: PDFKit.PDFDocument, tableDef: TableDef): void {
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 42;
  const headerHeight = 20;
  const defaultRowHeight = 18;

  let currentY = tableDef.startY || doc.y;

  const drawTableHeader = (y: number) => {
    doc.rect(margin, y, contentWidth, headerHeight).fill(HR_THEME.colors.tableHeaderFill);

    let colX = margin;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(HR_THEME.colors.tableHeaderText);
    tableDef.columns.forEach((col) => {
      doc.text(col.header.toUpperCase(), colX + 4, y + 6, {
        width: col.width - 8,
        align: col.align || "left",
      });
      colX += col.width;
    });
    return y + headerHeight;
  };

  currentY = drawTableHeader(currentY);

  if (tableDef.rows.length === 0) {
    doc.rect(margin, currentY, contentWidth, 24).fillAndStroke("#FFFFFF", HR_THEME.colors.tableBorder);
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(HR_THEME.colors.textMuted);
    doc.text("No matching records found for the specified criteria.", margin + 10, currentY + 8);
    doc.y = currentY + 24 + 10;
    return;
  }

  tableDef.rows.forEach((row, rowIndex) => {
    // Check if new page is needed
    if (currentY + defaultRowHeight > bottomLimit) {
      doc.addPage();
      currentY = doc.page.margins.top + 8;
      // Repeat table header on new page
      currentY = drawTableHeader(currentY);
    }

    const rowFill = rowIndex % 2 === 0 ? HR_THEME.colors.whiteRowFill : HR_THEME.colors.zebraRowFill;
    doc.rect(margin, currentY, contentWidth, defaultRowHeight).fillAndStroke(rowFill, HR_THEME.colors.tableBorder);

    let cellX = margin;
    tableDef.columns.forEach((col, colIdx) => {
      const rawVal = row[colIdx];
      const valStr = rawVal !== null && rawVal !== undefined ? String(rawVal) : "N/A";

      if (col.badge && valStr !== "N/A") {
        const badgeColors = getStatusBadgeTheme(valStr);
        const badgePaddingX = 4;
        const badgeHeight = 12;
        doc.fontSize(6.5);
        const textWidth = Math.min(doc.widthOfString(valStr) + badgePaddingX * 2, col.width - 6);
        const badgeX = col.align === "center"
          ? cellX + (col.width - textWidth) / 2
          : cellX + 3;

        doc.roundedRect(badgeX, currentY + 3, textWidth, badgeHeight, 2)
          .fill(badgeColors.bg);
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(badgeColors.text);
        doc.text(valStr, badgeX, currentY + 5, {
          width: textWidth,
          align: "center",
          ellipsis: true,
          lineBreak: false,
        });
      } else {
        doc.font("Helvetica").fontSize(7.5).fillColor(HR_THEME.colors.textPrimary);
        doc.text(valStr, cellX + 4, currentY + 5, {
          width: col.width - 8,
          align: col.align || "left",
          ellipsis: true,
          lineBreak: false,
        });
      }

      cellX += col.width;
    });

    currentY += defaultRowHeight;
  });

  doc.y = currentY + 12;
}

/**
 * Render running headers, footers with page count, and HR sign-off block across buffered pages
 */
export function renderFootersAndPagination(doc: PDFKit.PDFDocument, meta: ReportMetadata): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // HR Certification Sign-off Block on the final page
    const margin = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const signOffHeight = 36;
    const signOffY = Math.min(doc.y + 10, doc.page.height - doc.page.margins.bottom - 48);

    if (doc.y + signOffHeight < doc.page.height - doc.page.margins.bottom - 20) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(HR_THEME.colors.textSecondary);
      doc.text("VERIFIED / CERTIFIED ACCURATE:", margin, signOffY, { lineBreak: false });
      doc.text("CONCURRENCE / AUDIT CLEARANCE:", margin + contentWidth * 0.55, signOffY, { lineBreak: false });

      doc.font("Helvetica").fontSize(7).fillColor(HR_THEME.colors.textMuted);
      doc.text("________________________________________", margin, signOffY + 14, { lineBreak: false });
      doc.text("________________________________________", margin + contentWidth * 0.55, signOffY + 14, { lineBreak: false });

      doc.text(`Generated by: ${meta.requestedByEmail}`, margin, signOffY + 24, { lineBreak: false });
      doc.text("Executive Authority / HR Compliance Officer", margin + contentWidth * 0.55, signOffY + 24, { lineBreak: false });
    }

    // Two-pass footer and header rendering across all buffered pages
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const oldBottom = doc.page.margins.bottom;
      // Temporarily clear bottom margin so footer text does NOT trigger continueOnNewPage
      doc.page.margins.bottom = 0;

      const pageMargin = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const footerY = doc.page.height - 24;

      // Running Header on subsequent pages
      if (i > 0) {
        doc.fontSize(6.5).font("Helvetica").fillColor(HR_THEME.colors.textMuted);
        doc.text(`${meta.organization} • ${meta.documentCode}`, pageMargin, 16, { lineBreak: false });

        const classText = meta.classification;
        doc.font("Helvetica-Bold");
        const classWidth = doc.widthOfString(classText);
        doc.text(classText, pageMargin + pageWidth - classWidth, 16, { lineBreak: false });
        doc.rect(pageMargin, 26, pageWidth, 0.5).fill(HR_THEME.colors.tableBorder);
      }

      // Running Footer
      doc.rect(pageMargin, footerY - 5, pageWidth, 0.5).fill(HR_THEME.colors.tableBorder);

      doc.fontSize(6.5).font("Helvetica-Bold").fillColor(HR_THEME.colors.textMuted);
      doc.text(meta.classification, pageMargin, footerY, { lineBreak: false });

      doc.font("Helvetica").fillColor(HR_THEME.colors.textMuted);
      doc.text(
        "Privileged HR Record • Confidential • Unauthorized distribution is prohibited",
        pageMargin + 160,
        footerY,
        { lineBreak: false }
      );

      doc.font("Helvetica-Bold").fillColor(HR_THEME.colors.primaryNavy);
      const pageStr = `Page ${i + 1} of ${totalPages}`;
      const pageStrWidth = doc.widthOfString(pageStr);
      doc.text(pageStr, pageMargin + pageWidth - pageStrWidth, footerY, { lineBreak: false });

      // Restore bottom margin
      doc.page.margins.bottom = oldBottom;
    }

    doc.end();
  });
}
