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
  const col1X = margin + 10;
  const col2X = margin + contentWidth * 0.35;
  const col3X = margin + contentWidth * 0.70;
  const labelGap = 4;

  doc.fontSize(7.5).font("Helvetica-Bold");
  const showingLabel = "SHOWING:";
  const showingX = col2X + doc.widthOfString(showingLabel) + labelGap;
  const showingWidth = margin + contentWidth - 10 - showingX;
  doc.font("Helvetica");
  // The filter line wraps inside the card instead of being cut off.
  const showingHeight = doc.heightOfString(meta.filterSummary, { width: showingWidth });
  const metaHeight = Math.max(44, 20 + showingHeight + 10);
  doc.roundedRect(margin, metaY, contentWidth, metaHeight, 3)
    .fillAndStroke("#F8FAFC", HR_THEME.colors.tableBorder);

  const field = (label: string, value: string, x: number, y: number, color: string, width?: number) => {
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(HR_THEME.colors.textSecondary);
    doc.text(label, x, y, { lineBreak: false });
    const valueX = x + doc.widthOfString(label) + labelGap;
    doc.font("Helvetica").fillColor(color);
    doc.text(value, valueX, y, width ? { width } : { lineBreak: false });
  };

  // Line 1
  field("REPORT NO.:", meta.documentCode, col1X, metaY + 7, HR_THEME.colors.primaryNavy);
  field("CREATED ON:", meta.generatedAtFormatted, col2X, metaY + 7, HR_THEME.colors.primaryNavy);
  field("PREPARED FOR:", meta.roleScope === "ADMINISTRATOR" ? "Admin (whole team)" : "Recruiter (own records)", col3X, metaY + 7, HR_THEME.colors.accentTeal);

  // Line 2
  field("CREATED BY:", meta.requestedByEmail, col1X, metaY + 20, HR_THEME.colors.primaryNavy);
  field(showingLabel, meta.filterSummary, col2X, metaY + 20, HR_THEME.colors.textSecondary, showingWidth);

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
  const cardGap = 8;
  const count = Math.min(kpis.length, 7);
  const cardWidth = (contentWidth - (count - 1) * cardGap) / count;
  const inner = cardWidth - 16;

  // Labels and details wrap rather than being cut, so every card is sized to the tallest one.
  const heightOf = (text: string, font: string, size: number) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width: inner });
  };
  const labelHeight = Math.max(...kpis.slice(0, count).map((k) => heightOf(k.label.toUpperCase(), "Helvetica-Bold", 7)));
  const detailHeight = Math.max(0, ...kpis.slice(0, count).map((k) => (k.subtext ? heightOf(k.subtext, "Helvetica", 6.5) : 0)));
  const valueY = startY + 6 + labelHeight + 2;
  const detailY = valueY + 16;
  const cardHeight = detailY - startY + detailHeight + 6;

  kpis.slice(0, count).forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + cardGap);
    doc.roundedRect(cardX, startY, cardWidth, cardHeight, 3)
      .fillAndStroke(HR_THEME.colors.kpiCardFill, HR_THEME.colors.kpiCardBorder);

    doc.font("Helvetica-Bold").fontSize(7).fillColor(HR_THEME.colors.textMuted);
    doc.text(kpi.label.toUpperCase(), cardX + 8, startY + 6, { width: inner });

    doc.font("Helvetica-Bold").fontSize(12).fillColor(HR_THEME.colors.primaryNavy);
    doc.text(String(kpi.value), cardX + 8, valueY, { width: inner });

    if (kpi.subtext) {
      doc.font("Helvetica").fontSize(6.5).fillColor(HR_THEME.colors.textMuted);
      doc.text(kpi.subtext, cardX + 8, detailY, { width: inner });
    }
  });

  doc.y = startY + cardHeight + 12;
}

/** Section heading with an optional one-line note. Starts a new page when little room is left for a table. */
export function renderSectionTitle(doc: PDFKit.PDFDocument, title: string, note?: string): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 110) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(HR_THEME.colors.primaryNavy);
  doc.text(title, doc.page.margins.left, doc.y, { lineBreak: false });
  doc.y += 14;
  if (note) {
    doc.font("Helvetica").fontSize(7.5).fillColor(HR_THEME.colors.textMuted);
    doc.text(note, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
    doc.y += 4;
  }
  doc.y += 2;
}

/**
 * Render structured vector grid table with repeating headers on page breaks
 */
export function renderGridTable(doc: PDFKit.PDFDocument, tableDef: TableDef): void {
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 42;
  const padY = 5;
  const badgePadX = 4;

  // Text wraps onto extra lines instead of being cut short, so every word in the table stays readable.
  const textHeight = (text: string, width: number, font: string, size: number) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width });
  };
  const cellText = (raw: string | number | null | undefined) => (raw !== null && raw !== undefined && raw !== "" ? String(raw) : "—");
  const badgeWidth = (text: string, col: ColumnDef) => {
    doc.font("Helvetica-Bold").fontSize(6.5);
    return Math.min(doc.widthOfString(text) + badgePadX * 2, col.width - 6);
  };

  const headerHeight = Math.max(
    20,
    ...tableDef.columns.map((col) => textHeight(col.header.toUpperCase(), col.width - 8, "Helvetica-Bold", 7.5) + padY * 2)
  );

  let currentY = tableDef.startY || doc.y;

  const drawTableHeader = (y: number) => {
    doc.rect(margin, y, contentWidth, headerHeight).fill(HR_THEME.colors.tableHeaderFill);

    let colX = margin;
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(HR_THEME.colors.tableHeaderText);
    tableDef.columns.forEach((col) => {
      doc.text(col.header.toUpperCase(), colX + 4, y + padY, {
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
    doc.text("Nothing to show for the dates and filters you picked.", margin + 10, currentY + 8);
    doc.y = currentY + 24 + 10;
    return;
  }

  tableDef.rows.forEach((row, rowIndex) => {
    const values = tableDef.columns.map((_, colIdx) => cellText(row[colIdx]));
    const rowHeight = Math.max(
      18,
      ...tableDef.columns.map((col, colIdx) => {
        const v = values[colIdx];
        if (col.badge && v !== "—") return textHeight(v, badgeWidth(v, col) - badgePadX * 2, "Helvetica-Bold", 6.5) + 4 + padY * 2;
        return textHeight(v, col.width - 8, "Helvetica", 7.5) + padY * 2;
      })
    );

    // Check if new page is needed
    if (currentY + rowHeight > bottomLimit) {
      doc.addPage();
      currentY = doc.page.margins.top + 8;
      // Repeat table header on new page
      currentY = drawTableHeader(currentY);
    }

    const rowFill = rowIndex % 2 === 0 ? HR_THEME.colors.whiteRowFill : HR_THEME.colors.zebraRowFill;
    doc.rect(margin, currentY, contentWidth, rowHeight).fillAndStroke(rowFill, HR_THEME.colors.tableBorder);

    let cellX = margin;
    tableDef.columns.forEach((col, colIdx) => {
      const valStr = values[colIdx];

      if (col.badge && valStr !== "—") {
        const badgeColors = getStatusBadgeTheme(valStr);
        const width = badgeWidth(valStr, col);
        const innerHeight = textHeight(valStr, width - badgePadX * 2, "Helvetica-Bold", 6.5);
        const badgeX = col.align === "center"
          ? cellX + (col.width - width) / 2
          : cellX + 3;

        doc.roundedRect(badgeX, currentY + 3, width, innerHeight + 4, 2)
          .fill(badgeColors.bg);
        doc.font("Helvetica-Bold").fontSize(6.5).fillColor(badgeColors.text);
        doc.text(valStr, badgeX + badgePadX, currentY + 5, {
          width: width - badgePadX * 2,
          align: "center",
        });
      } else {
        doc.font("Helvetica").fontSize(7.5).fillColor(HR_THEME.colors.textPrimary);
        doc.text(valStr, cellX + 4, currentY + padY, {
          width: col.width - 8,
          align: col.align || "left",
        });
      }

      cellX += col.width;
    });

    currentY += rowHeight;
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
      doc.text("CHECKED BY:", margin, signOffY, { lineBreak: false });
      doc.text("APPROVED BY:", margin + contentWidth * 0.55, signOffY, { lineBreak: false });

      doc.font("Helvetica").fontSize(7).fillColor(HR_THEME.colors.textMuted);
      doc.text("________________________________________", margin, signOffY + 14, { lineBreak: false });
      doc.text("________________________________________", margin + contentWidth * 0.55, signOffY + 14, { lineBreak: false });

      doc.text(`Generated by: ${meta.requestedByEmail}`, margin, signOffY + 24, { lineBreak: false });
      doc.text("Name and signature", margin + contentWidth * 0.55, signOffY + 24, { lineBreak: false });
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
        "For MEGS staff only • Do not share outside the company",
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
