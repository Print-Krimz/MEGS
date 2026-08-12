// scripts/make-test-pdf.mjs
// Generates a minimal valid PDF containing applicant resume text.
// Run with: node scripts/make-test-pdf.mjs

import { writeFileSync } from "fs";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

// Use PDFKit if available, otherwise build minimal PDF manually
let pdfBuffer;

try {
  const PDFDocument = _require("pdfkit");
  await new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => {
      pdfBuffer = Buffer.concat(chunks);
      resolve();
    });
    doc.on("error", reject);
    doc.fontSize(14).text("John Doe — Senior React Developer");
    doc.fontSize(11).moveDown();
    doc.text("EXPERIENCE");
    doc.text("Frontend Developer — Tech Corp (2020–Present)");
    doc.text("Built scalable web apps using React, TypeScript, REST APIs, Zustand, Redux, Vite.");
    doc.text("");
    doc.text("SKILLS");
    doc.text("React, TypeScript, Node.js, Zustand, Redux, Webpack, ESLint, REST APIs");
    doc.text("");
    doc.text("EDUCATION");
    doc.text("BS Computer Science — University of the Philippines (2019)");
    doc.end();
  });
  console.log("✅ Generated PDF using PDFKit:", pdfBuffer.length, "bytes");
} catch {
  // PDFKit not installed — build a raw minimal PDF
  const text = [
    "John Doe Senior React Developer",
    "5 years experience React TypeScript REST APIs modern frontend tooling",
    "State management Zustand Redux",
    "Frontend tooling Vite Webpack ESLint",
  ].join(" | ");

  // Escape PDF special chars
  const safeText = text.replace(/[()\\]/g, (c) => `\\${c}`);
  const stream = `BT /F1 11 Tf 50 720 Td (${safeText}) Tj ET`;
  const raw = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj",
    `4 0 obj<</Length ${stream.length}>>\nstream\n${stream}\nendstream\nendobj`,
    "xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000275 00000 n ",
    "trailer<</Size 5/Root 1 0 R>>\nstartxref\n500\n%%EOF",
  ].join("\n");
  pdfBuffer = Buffer.from(raw, "latin1");
  console.log("✅ Generated minimal raw PDF:", pdfBuffer.length, "bytes");
}

writeFileSync("test_resume_real.pdf", pdfBuffer);
console.log("Saved to test_resume_real.pdf");
