import { describe, it, expect } from "vitest";
import {
  createHRDocument,
  renderCorporateHeader,
  renderSummaryKPIs,
  renderGridTable,
  renderFootersAndPagination,
} from "./report-pdf-builder.js";
import { getReportMetadata, ReportRoleScope } from "./report-theme.js";

describe("HR PDF Report Builder Engine", () => {
  it("creates an A4 landscape buffered document and exports a valid PDF buffer with corporate headers and table", async () => {
    const roleScope: ReportRoleScope = "TALENT_ACQUISITION";
    const meta = getReportMetadata({
      reportType: "PIPELINE",
      roleScope,
      requestedByEmail: "recruiter@megs.system",
      filterSummary: "Stage: Screening | Range: Last 30 Days",
      fixedDate: new Date("2026-09-04T08:00:00.000Z"),
    });

    const doc = await createHRDocument({ orientation: "landscape" });

    renderCorporateHeader(doc, meta);

    renderSummaryKPIs(doc, [
      { label: "Total Applications", value: 42 },
      { label: "Active Screening", value: 18 },
      { label: "Client Endorsed", value: 12 },
      { label: "Avg Match Score", value: "88.4%" },
    ]);

    renderGridTable(doc, {
      columns: [
        { header: "App ID", width: 60, align: "center" },
        { header: "Candidate Name", width: 140, align: "left" },
        { header: "Applied Role", width: 150, align: "left" },
        { header: "MRF Order", width: 110, align: "left" },
        { header: "Stage", width: 110, align: "center", badge: true },
        { header: "AI Match", width: 80, align: "right" },
        { header: "Applied Date", width: 90, align: "center" },
      ],
      rows: [
        ["#101", "Juan Dela Cruz", "Logistics Associate", "MRF-457", "INITIAL_SCREENING", "94%", "2026-09-01"],
        ["#102", "Maria Santos", "Warehouse Supervisor", "MRF-458", "CLIENT_ENDORSEMENT", "89%", "2026-09-02"],
        ["#103", "Robert Chen", "Forklift Operator", "MRF-457", "DEPLOYED", "91%", "2026-09-03"],
      ],
    });

    const pdfBuffer = await renderFootersAndPagination(doc, meta);

    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    // PDF Magic Bytes
    expect(pdfBuffer.toString("utf-8", 0, 4)).toBe("%PDF");
  });

  it("prints the time window and the definition on a KPI card", async () => {
    const doc = await createHRDocument({ orientation: "landscape" });
    const printed: string[] = [];
    const original = doc.text.bind(doc);
    (doc as any).text = (text: string, ...rest: unknown[]) => {
      printed.push(String(text));
      return (original as any)(text, ...rest);
    };
    renderSummaryKPIs(doc, [
      { label: "Backout rate", value: "Too few to show (3 cases)", subtext: "1 of 3", basis: "In these dates", definition: "Workers who backed out after client review, out of those plus starts." },
    ]);
    expect(printed).toContain("In these dates");
    expect(printed).toContain("Workers who backed out after client review, out of those plus starts.");
    expect(printed).toContain("Too few to show (3 cases)");
  });

  it("handles multi-page table wrapping by adding pages and repeating table headers", async () => {
    const meta = getReportMetadata({
      reportType: "DEPLOYMENT",
      roleScope: "ADMINISTRATOR",
      requestedByEmail: "admin@megs.system",
      filterSummary: "All Deployments",
      fixedDate: new Date("2026-09-04T08:00:00.000Z"),
    });

    const doc = await createHRDocument({ orientation: "landscape" });
    renderCorporateHeader(doc, meta);

    // Create 35 rows to force multiple pages
    const rows = Array.from({ length: 35 }, (_, i) => [
      `#${200 + i}`,
      `Client Enterprise ${i + 1}`,
      `Employee Test ${i + 1}`,
      "ON_SITE",
      `Manila Facility ${i + 1}`,
      "2026-08-01",
      "2026-12-31",
    ]);

    renderGridTable(doc, {
      columns: [
        { header: "Deployment ID", width: 90, align: "center" },
        { header: "Client Corporation", width: 160, align: "left" },
        { header: "Placed Candidate", width: 140, align: "left" },
        { header: "Status", width: 100, align: "center", badge: true },
        { header: "Assigned Facility", width: 110, align: "left" },
        { header: "Contract Start", width: 80, align: "center" },
        { header: "Contract End", width: 80, align: "center" },
      ],
      rows,
    });

    const pdfBuffer = await renderFootersAndPagination(doc, meta);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(2000);
    expect(pdfBuffer.toString("utf-8", 0, 4)).toBe("%PDF");
  });

  it("does not generate phantom blank pages during footer and pagination rendering", async () => {
    const meta = getReportMetadata({
      reportType: "PIPELINE",
      roleScope: "TALENT_ACQUISITION",
      requestedByEmail: "recruiter@megs.system",
      filterSummary: "Stage: All",
      fixedDate: new Date("2026-09-04T08:00:00.000Z"),
    });

    const doc = await createHRDocument({ orientation: "landscape" });
    renderCorporateHeader(doc, meta);

    // 100 rows across A4 landscape (with the logo header) generate exactly 6 pages
    const rows = Array.from({ length: 100 }, (_, i) => [
      `#${1000 + i}`,
      `Candidate Name ${i + 1}`,
      `Position Title ${i + 1}`,
      `MRF-${i + 1}`,
      "INITIAL_SCREENING",
      "85%",
      "2026-09-01",
    ]);

    renderGridTable(doc, {
      columns: [
        { header: "App ID", width: 70, align: "center" },
        { header: "Candidate Name", width: 150, align: "left" },
        { header: "Applied Role", width: 150, align: "left" },
        { header: "MRF Order", width: 100, align: "left" },
        { header: "Stage", width: 120, align: "center", badge: true },
        { header: "AI Match", width: 80, align: "right" },
        { header: "Applied Date", width: 100, align: "center" },
      ],
      rows,
    });

    const contentPages = doc.bufferedPageRange().count;
    const pdfBuffer = await renderFootersAndPagination(doc, meta);

    const pdfContent = pdfBuffer.toString("latin1");
    const pageMatches = pdfContent.match(/\/Type\s*\/Page\b/g);
    const finalPageCount = pageMatches ? pageMatches.length : 0;

    // Must match exact content pages (e.g. 6) and NOT multiply into 20 due to blank pages
    expect(finalPageCount).toBe(contentPages);
    expect(finalPageCount).toBe(6);
  });
});
