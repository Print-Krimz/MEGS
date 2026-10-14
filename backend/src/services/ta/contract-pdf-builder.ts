/**
 * MEGS employment contract (work assignment letter) PDF builder.
 *
 * Reproduces the official one-page MEGS contract. The TA prints the generated copy, the employee signs it
 * and presses a right thumbmark, and the signed scan is uploaded back to the application.
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export interface ContractPdfData {
  employeeName: string;
  issueDate: Date;
  startDate: Date;
  position: string;
  /** Left blank on the printout when omitted, so the TA can write the rate by hand. */
  dailyRate?: number | string | null;
}

const COMPANY_NAME = "MAR EMPLOYMENT FOR GOOD SERVICES, INC";
const COMPANY_ADDRESS = "2nd Flr. PJAR Building #9 P. Gomez St. Oreta Subd. Malinta Valenzuela City";

export const CONTRACT_CLAUSES = [
  "Ang iyong \u201Cwork assignment\u201D ay magiging epektibo sa {START_DATE}.",
  "Ang iyong posisyon ay {POSITION}.",
  "Sa oras na matapos ang iyong \u201CProbationary Period\u201D at makapasa sa \u201CPerformance Evaluation\u201D ikaw ay ikokonsider ang \u201CRegular Member-Employee\u201D ng MAR EMPLOYMENT FOR GOOD SERVICES, INC.",
  "Ang iyong sahod ay naaayon sa kasalukuyang \u201Cminimum wage\u201D na Php {DAILY_RATE} kada araw at ikaw ay tatanggap din ng iba pang mga benepisyo na ipinagkakaloob ng kasalukuyang batas.",
  "Ikaw ay dapat magtrabaho ng \u201CFull Time\u201D sa Client-Company alinsunod sa kanilang itinatag na mga araw at oras ng trabaho.",
  "Ikaw ay dapat sumunod sa mga batas o alituntunin ng kumpanya at ang mga paglabag nito ay may karampatang kaparusahan base sa uri o bigat ng iyong paglabag.",
  "Ikaw ay dapat na manatili sa iyong \u201Cwork assignment\u201D maliban na lamang kung ikaw ay pinatawag o dahil sa ibang dahilan na naayon sa batas.",
  "Nauunawaan mo na kung ang kliyente namin, kung saan ka naka-assign, ay mag-charge sa kompanya ng \u201Cmonetary damages\u201D dahil sa iyong kapabayaan o maling pagganap ng tungkulin, at ito ay napatunayan sa isinagawang imbestigasyon ng aming kliyente, ang nasabing danyos ay ibabawas sa iyong sahod.",
  "Nauunawaan mo na ang anumang impormasyong nalalaman mo na may kaugnayan sa iyong trabaho sa amin kliyente o kompanya ay kumpidensyal at hindi maaaring ibahagi sa kahit na kanino nang walang pahintulot mula sa aming kliyente o kompanya.",
];

export const CONTRACT_CONFIDENTIALITY_NOTE =
  "Ang anumang hindi awtorisadong paglabas o pagbabahagi ng kumpidensyal na impormasyon, sinasadya man o hindi, ay ituturing na paglabag sa kontrata. Sa ganitong sitwasyon may karapatan ang kompanya na magsampa ng kaukulang aksyon o kaso laban sa iyo.";

// The server always runs from the backend folder (dev and `node dist/server.js`), so the logo lives in backend/assets.
const LOGO_PATH = path.resolve(process.cwd(), "assets", "megs-logo.jpg");

const formatDate = (date: Date): string =>
  new Date(date).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const BLANK_RATE = "______________";

const formatRate = (rate?: number | string | null): string =>
  rate === undefined || rate === null || rate === ""
    ? BLANK_RATE
    : Number(rate).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const buildContractPdfBuffer = (data: ContractPdfData): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: "MEGS Employment Contract" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;

    const hasLogo = fs.existsSync(LOGO_PATH);
    const logoWidth = 84;
    const headerX = hasLogo ? left + logoWidth + 14 : left;
    const headerWidth = width - (headerX - left);
    if (hasLogo) doc.image(LOGO_PATH, left, 50, { width: logoWidth });
    doc.font("Helvetica-Bold").fontSize(15).text(COMPANY_NAME, headerX, 62, { width: headerWidth, align: hasLogo ? "left" : "center" });
    doc.font("Helvetica").fontSize(8.5).text(COMPANY_ADDRESS, headerX, doc.y, { width: headerWidth, align: hasLogo ? "left" : "center" });
    doc.y = Math.max(doc.y, hasLogo ? 50 + logoWidth * 0.72 : 0);
    doc.moveDown(1.6);

    doc.font("Helvetica-Bold").fontSize(10.5).text(`Petsa: ${formatDate(data.issueDate)}`, left, doc.y, { width });
    doc.moveDown(0.8);
    doc.text(`PARA KAY: ${data.employeeName}`, { width });
    doc.moveDown(1);

    doc.font("Helvetica").fontSize(10.5).text("Ito ay para kompirmahin ang pagtanggap namin sa inyong serbisyo ayon sa kasunduan na:", {
      width,
      indent: 24,
    });
    doc.moveDown(0.8);

    const values: Record<string, string> = {
      "{START_DATE}": formatDate(data.startDate),
      "{POSITION}": data.position,
      "{DAILY_RATE}": formatRate(data.dailyRate),
    };
    CONTRACT_CLAUSES.forEach((clause, index) => {
      const text = Object.entries(values).reduce((acc, [token, value]) => acc.replace(token, value), clause);
      doc.font("Helvetica").fontSize(10).text(`${index + 1}. ${text}`, left, doc.y, { width, align: "justify" });
      doc.moveDown(0.6);
    });

    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10).text(CONTRACT_CONFIDENTIALITY_NOTE, left, doc.y, { width, align: "justify" });

    const signY = Math.max(doc.y + 36, 610);
    doc.font("Helvetica-Bold").fontSize(10);
    doc.text("TINANGGAP AT NAINTINDIHAN", left, signY, { width: width / 2 });
    doc.text(`${COMPANY_NAME}\nEMPLOYER`, left + width / 2, signY, { width: width / 2, align: "center" });

    const boxY = signY + 34;
    doc.rect(left, boxY, 80, 80).dash(2, { space: 2 }).stroke().undash();

    const lineY = boxY + 80 + 28;
    doc.font("Helvetica-Bold").fontSize(9).text("Right Thumbmark", left, boxY + 86);
    doc.moveTo(left + 110, lineY).lineTo(left + 300, lineY).stroke();
    doc.font("Helvetica").fontSize(8.5).text("(Employee's Signature over Printed Name)", left + 110, lineY + 4);
    doc.moveTo(left + width / 2 + 30, lineY).lineTo(left + width, lineY).stroke();
    doc.text("(Authorized Signature over Printed Name)", left + width / 2 + 30, lineY + 4, {
      width: width / 2 - 30,
      align: "center",
    });

    doc.end();
  });
