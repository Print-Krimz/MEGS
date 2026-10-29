import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { validateDocumentBytes, MAX_DOCUMENT_BYTES } from "../../src/security/file-validation.js";
import { extractDocumentText } from "../../src/security/document-parser.js";
import { decompressBackupPayload, validateBackupStructure, MAX_BACKUP_EXPANDED_BYTES } from "../../src/security/backup-limits.js";

const imageFixtures = {"PNG": "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAE0lEQVR4nGP8//8/AwMDEwMYAAAkBgMBXaJOiAAAAABJRU5ErkJggg==", "JPEG": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==", "WEBP": "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAUAmJaQAA3AA/vz0AAA="};

async function docx(text = "A valid candidate resume with useful experience."): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function pdf(): Promise<Buffer> {
  return new Promise(resolve => {
    const document = new PDFDocument({ compress: false, pdfVersion: "1.4" }); const chunks: Buffer[] = [];
    document.on("data", chunk => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.text("Candidate resume: JavaScript engineering and recruitment experience.");
    document.addPage().text("Education and skills."); document.end();
  });
}

describe("document validation and isolated parsing", () => {
  it("rejects mislabeled, truncated and oversized content", () => {
    expect(() => validateDocumentBytes(Buffer.from("fake pdf"), "application/pdf")).toThrow();
    expect(() => validateDocumentBytes(Buffer.from("%PDF-1.7\ntruncated"), "application/pdf")).toThrow();
    expect(() => validateDocumentBytes(Buffer.alloc(MAX_DOCUMENT_BYTES + 1))).toThrow();
    expect(() => validateDocumentBytes(Buffer.from("%PDF-1.7\n%%EOF"), "image/png")).toThrow();
  });
  it("accepts bounded DOCX and extracts real text in an isolated worker", async () => {
    const buffer = await docx();
    expect(validateDocumentBytes(buffer).extension).toBe("docx");
    expect(await extractDocumentText(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toContain("valid candidate resume");
  });
  it("extracts a generated valid PDF through the actual worker", async () => {
    const buffer = await pdf();
    expect(validateDocumentBytes(buffer).extension).toBe("pdf");
    expect(await extractDocumentText(buffer, "application/pdf")).toContain("Candidate resume");
  });
  it("extracts a real offline binary DOC fixture through the actual isolated parser", async () => {
    const buffer = readFileSync("tests/security/fixtures/word-simple.doc");
    expect(validateDocumentBytes(buffer).extension).toBe("doc");
    expect(await extractDocumentText(buffer, "application/msword")).toContain("This line gets read fine");
  });
  it("rejects expansion-heavy DOCX, disguised ZIP and unsafe archive paths", async () => {
    const zip = new JSZip(); zip.file("payload.txt", "harmless");
    expect(() => validateDocumentBytes(Buffer.from([]))).toThrow();
    const ordinary = await zip.generateAsync({ type: "nodebuffer" });
    expect(() => validateDocumentBytes(ordinary)).toThrow();
    const bomb = await docx("A".repeat(9 * 1024 * 1024));
    expect(() => validateDocumentBytes(bomb)).toThrow();
    zip.file("../word/document.xml", "bad");
    const traversal = await zip.generateAsync({ type: "nodebuffer" });
    expect(() => validateDocumentBytes(traversal)).toThrow();
  });
  it("keeps supported real image fixtures available", () => {
    expect(validateDocumentBytes(Buffer.from(imageFixtures.JPEG, "base64")).extension).toBe("jpg");
    expect(validateDocumentBytes(Buffer.from(imageFixtures.PNG, "base64")).extension).toBe("png");
    expect(validateDocumentBytes(Buffer.from(imageFixtures.WEBP, "base64")).extension).toBe("webp");
  });
  it("rejects truncated images and oversized dimensions", () => {
    const tooLarge = Buffer.from(imageFixtures.PNG, "base64"); tooLarge.writeUInt32BE(50000, 16); tooLarge.writeUInt32BE(50000, 20);
    expect(() => validateDocumentBytes(tooLarge)).toThrow("dimensions");
    const png = Buffer.alloc(25); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.write("IHDR",12);
    expect(() => validateDocumentBytes(png)).toThrow();
    expect(() => validateDocumentBytes(Buffer.from([0xff,0xd8,0xff,0xd9]))).toThrow();
    const webp = Buffer.alloc(20); webp.write("RIFF",0); webp.writeUInt32LE(12,4); webp.write("WEBP",8); webp.write("VP8L",12);
    expect(() => validateDocumentBytes(webp)).toThrow();
    const doc = Buffer.alloc(512); Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]).copy(doc); Buffer.from("WordDocument", "utf16le").copy(doc, 100);
    expect(() => validateDocumentBytes(doc)).toThrow();
  });
});

describe("authenticated backup archive bounds", () => {
  it("preserves legitimate gzip JSON payloads and rejects malformed records", async () => {
    const snapshot = { meta: { version: 1 }, data: { users: [{ id: "test" }] } };
    const restored = await decompressBackupPayload(gzipSync(Buffer.from(JSON.stringify(snapshot))));
    expect(JSON.parse(restored.toString())).toEqual(snapshot);
    expect(() => validateBackupStructure(snapshot)).not.toThrow();
    expect(() => validateBackupStructure({ meta: {}, data: { users: ["invalid"] } })).toThrow();
  });
  it("stops expansion beyond the actual output bound", async () => {
    const compressed = gzipSync(Buffer.alloc(MAX_BACKUP_EXPANDED_BYTES + 1, 65));
    await expect(decompressBackupPayload(compressed)).rejects.toThrow("limits");
  });
});
