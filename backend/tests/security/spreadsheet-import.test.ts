import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { isXlsxArchive, validateSpreadsheetBytes } from "../../src/security/file-validation.js";
import {
  buildImportTemplate, cellText, importClientRows, importRequestRows, SpreadsheetImportError,
} from "../../src/services/ta/spreadsheet-import.service.js";

const CLIENT_KEYS = ["name", "contactEmail", "contactPhone", "industry"];

async function workbookBuffer(build: (sheet: ExcelJS.Worksheet) => void): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  build(workbook.addWorksheet("Sheet1"));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("isXlsxArchive", () => {
  it("accepts a real workbook", async () => {
    const xlsx = await workbookBuffer((s) => s.addRow(["a"]));
    expect(isXlsxArchive(xlsx)).toBe(true);
    expect(() => validateSpreadsheetBytes(xlsx)).not.toThrow();
  });

  it("rejects a Word file and a plain zip", async () => {
    const docx = new JSZip();
    docx.file("[Content_Types].xml", "<Types/>");
    docx.file("word/document.xml", "<w:document/>");
    const plain = new JSZip();
    plain.file("payload.txt", "harmless");
    for (const zip of [docx, plain]) {
      const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      expect(isXlsxArchive(bytes)).toBe(false);
      expect(() => validateSpreadsheetBytes(bytes)).toThrow();
    }
    expect(isXlsxArchive(Buffer.from("not a zip at all, just text"))).toBe(false);
  });
});

describe("cellText", () => {
  it("reads rich text, formula results, hyperlinks, dates and numbers as trimmed text", () => {
    expect(cellText({ richText: [{ text: " Acme " }, { text: "Corp" }] })).toBe("Acme Corp");
    expect(cellText({ formula: "A1&B1", result: "Result " })).toBe("Result");
    expect(cellText({ formula: "1/0", result: { error: "#DIV/0!" } })).toBe("");
    expect(cellText({ text: "site", hyperlink: "https://x.test" })).toBe("site");
    expect(cellText(new Date(Date.UTC(2027, 0, 5)))).toBe("2027-01-05");
    expect(cellText(12000.5)).toBe("12000.5");
    expect(cellText(null)).toBe("");
  });
});

describe("importClientRows", () => {
  it("skips the title row and the unchanged example, ignores empty rows, and keeps real row numbers", async () => {
    const template = await buildImportTemplate("clients");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template as never);
    const sheet = workbook.worksheets[0]!;
    sheet.addRow([]);
    sheet.addRow(["Acme Staffing Corp", "", "Retail", "Ana", "Reyes", "ana@acme.test", "09171234567"]);
    const rows = await importClientRows(Buffer.from(await workbook.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rowNumber).toBe(5);
    expect(rows[0]!.status).toBe("SUCCESS");
    expect(rows[0]!.fields.name).toBe("Acme Staffing Corp");
    expect(rows[0]!.fields.contactEmail).toBe("ana@acme.test");
  });

  it("maps rows by header key and flags values the form would reject", async () => {
    const xlsx = await workbookBuffer((s) => {
      s.addRow(CLIENT_KEYS);
      s.addRow(["Beta Corp", "not-an-email", 9171234567, "Logistics"]);
      s.addRow([{ richText: [{ text: "Gamma " }, { text: "Inc" }] }, "", "", ""]);
    });
    const rows = await importClientRows(xlsx);
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
    expect(rows[0]!.fields.name).toBe("Beta Corp");
    expect(rows[0]!.issues.contactEmail).toBe("invalid");
    expect(rows[0]!.fields.contactPhone).toBe("09171234567");
    expect(rows[1]!.fields.name).toBe("Gamma Inc");
  });

  it("rejects a sheet with no template headers", async () => {
    const xlsx = await workbookBuffer((s) => { s.addRow(["Foo", "Bar"]); s.addRow(["1", "2"]); });
    await expect(importClientRows(xlsx)).rejects.toThrow(SpreadsheetImportError);
  });

  it("rejects more than 100 data rows with a clear message", async () => {
    const xlsx = await workbookBuffer((s) => {
      s.addRow(["name"]);
      for (let i = 0; i < 101; i++) s.addRow([`Company ${i}`]);
    });
    await expect(importClientRows(xlsx)).rejects.toThrow("This file has more than 100 rows. Split it into smaller files.");
    const ok = await workbookBuffer((s) => {
      s.addRow(["name"]);
      for (let i = 0; i < 100; i++) s.addRow([`Company ${i}`]);
    });
    expect(await importClientRows(ok)).toHaveLength(100);
  });
});

describe("importRequestRows", () => {
  it("maps request rows through the same rules as the form", async () => {
    const xlsx = await workbookBuffer((s) => {
      s.addRow(["title", "headcount", "location", "salaryRangeMin", "salaryRangeMax", "priority", "targetFillDate"]);
      s.addRow(["Warehouse Staff", 5, "Taguig", 15000, 18000, "high", new Date(Date.UTC(2099, 0, 31))]);
      s.addRow(["", 3, "", "", "", "", ""]);
    });
    const rows = await importRequestRows(xlsx);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.fields).toMatchObject({ title: "Warehouse Staff", headcount: 5, location: "Taguig", salaryRangeMin: 15000, priority: "HIGH", targetFillDate: "2099-01-31" });
    expect(rows[1]!.issues.title).toBe("missing");
  });

  it("builds a template whose key row, title row and example row are in place", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await buildImportTemplate("requests")) as never);
    const sheet = workbook.worksheets[0]!;
    expect(sheet.getRow(1).getCell(1).value).toBe("title");
    expect(sheet.getRow(2).getCell(1).value).toBe("Position");
    expect(sheet.getRow(3).getCell(1).value).toBe("Production Operator");
    expect(await importRequestRows(await buildImportTemplate("requests"))).toHaveLength(0);
  });
});
