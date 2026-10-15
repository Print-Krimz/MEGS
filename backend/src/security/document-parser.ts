import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import { join } from "node:path";
import { validateDocumentBytes, MAX_EXTRACTED_TEXT } from "./file-validation.js";

const parserRequire = createRequire(typeof __filename === "string" ? __filename : join(process.cwd(), "package.json"));
let activeParsers = 0;
const parserCode = `
  const { parentPort, workerData } = require("node:worker_threads");
  (async () => {
    const buffer = Buffer.from(workerData.buffer);
    let text;
    // Older bundled PDF.js mishandles Node Buffer in a worker realm; an owned
    // Uint8Array preserves the exact bytes across both source and built runtime.
    if (workerData.mime === "application/pdf") text = (await require(workerData.pdf)(new Uint8Array(buffer))).text;
    else if (workerData.mime === "application/msword") {
      const Extractor = require(workerData.doc);
      text = (await new Extractor().extract(buffer)).getBody();
    } else text = (await require(workerData.docx).extractRawText({ buffer })).value;
    if (typeof text !== "string" || text.length > workerData.maxText) throw new Error("Parser text limit exceeded");
    parentPort.postMessage({ text });
  })().catch(() => parentPort.postMessage({ error: true }));
`;

// A deadline on a Promise alone leaves CPU work alive. Terminate the isolated
// parser, and cap both its V8 heap and the number of concurrent parser workers.
export async function extractDocumentText(buffer: Buffer, mimeType: string): Promise<string> {
  validateDocumentBytes(buffer, mimeType);
  if (mimeType.startsWith("image/")) return "";
  if (activeParsers >= 2) throw new Error("Document processing is busy. Please retry later.");
  activeParsers++;
  try {
    return await new Promise<string>((resolve, reject) => {
      const worker = new Worker(parserCode, {
        eval: true,
        workerData: { buffer, mime: mimeType, maxText: MAX_EXTRACTED_TEXT,
          pdf: parserRequire.resolve("pdf-parse/lib/pdf-parse.js"),
          docx: parserRequire.resolve("mammoth"), doc: parserRequire.resolve("word-extractor") },
        resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
      });
      let settled = false;
      const finish = async (error?: Error, text?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Keep the admission slot until termination actually finishes.
        await worker.terminate().catch(() => undefined);
        if (error) reject(error); else resolve(text!);
      };
      const timer = setTimeout(() => { void finish(new Error("Document parser exceeded its processing deadline")); }, 10_000);
      worker.once("message", (result) => {
        if (result.error || typeof result.text !== "string" || result.text.length > MAX_EXTRACTED_TEXT) void finish(new Error("Unable to extract document text safely"));
        else void finish(undefined, result.text.trim());
      });
      worker.once("error", () => { void finish(new Error("Unable to extract document text safely")); });
      worker.once("exit", () => { if (!settled) void finish(new Error("Document parser stopped before completing")); });
    });
  } finally { activeParsers--; }
}
