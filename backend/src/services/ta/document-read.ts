// Shared file routing for the "read a document into form values" features (MRF, client).
// Word -> extracted text; PDF -> text first, then the document itself; photo -> the document itself.
import { extractDocumentText, isUsableResumeText } from "../../security/document-parser.js";
import { classifyExtractionError } from "../../utils/gemini.js";

export interface DocumentReaders {
  fromText: (text: string) => Promise<Record<string, unknown>>;
  fromBuffer: (buffer: Buffer, mimeType: string) => Promise<Record<string, unknown>>;
}

export const readDocumentWith = async (
  buffer: Buffer, mimeType: string, { fromText, fromBuffer }: DocumentReaders, label: string,
): Promise<Record<string, unknown>> => {
  // Word files have no vision path: Gemini rejects their MIME types as inline data.
  if (mimeType.startsWith("application/") && mimeType !== "application/pdf") {
    const text = await extractDocumentText(buffer, mimeType);
    if (!text.trim()) throw new Error("Document text is empty or unreadable");
    return fromText(text);
  }
  if (mimeType === "application/pdf") {
    let text = "";
    try {
      text = await extractDocumentText(buffer, mimeType);
    } catch {
      console.warn(`[${label}] PDF text extraction failed; trying the document directly.`);
    }
    if (isUsableResumeText(text)) {
      try {
        return await fromText(text);
      } catch (error: any) {
        if (error?.retryable || error?.message === "AI processing timed out") throw error;
        console.warn(`[${label}] Text reading failed (${classifyExtractionError(error)}); trying the document directly.`);
      }
    }
  }
  return fromBuffer(buffer, mimeType);
};
