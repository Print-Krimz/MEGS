// Run after backend tsc/build. All fixtures are offline; no providers or DB.
const { extractDocumentText } = require("../../dist/src/security/document-parser.js");
const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");
const PDFDocument = require("pdfkit");

(async () => {
  const doc = fs.readFileSync(path.join(__dirname, "fixtures/word-simple.doc"));
  if (!(await extractDocumentText(doc, "application/msword")).includes("This line gets read fine")) throw new Error("Compiled DOC parser failed");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Compiled worker candidate resume.</w:t></w:r></w:p></w:body></w:document>');
  if (!(await extractDocumentText(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).includes("Compiled worker")) throw new Error("Compiled DOCX parser failed");
  const pdf = await new Promise(resolve => {
    const document = new PDFDocument({ pdfVersion: "1.4" }); const chunks = [];
    document.on("data", chunk => chunks.push(chunk)); document.on("end", () => resolve(Buffer.concat(chunks)));
    document.text("Compiled worker candidate resume."); document.addPage().text("Skills and education."); document.end();
  });
  if (!(await extractDocumentText(pdf, "application/pdf")).includes("Compiled worker")) throw new Error("Compiled PDF parser failed");
  console.log("PASS: production-compiled worker extracts PDF, DOCX and binary DOC offline.");
})().catch(error => { console.error(error); process.exitCode = 1; });
