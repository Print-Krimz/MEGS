import { z } from "zod";
import { boundedId, boundedIdText } from "./field-limits.js";

export const BULK_UPLOAD_MAX_FILES = 10;

const mappingEntry = z.object({ fileIndex: z.number().int().min(0).max(BULK_UPLOAD_MAX_FILES - 1), requirementId: boundedId }).strict();

/** The mapping arrives as a JSON string because the request is multipart. */
const mappingFromJson = z.string().max(4000).transform((raw, ctx) => {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { ctx.addIssue({ code: "custom", message: "Mapping must be valid JSON" }); return z.NEVER; }
  return parsed;
}).pipe(
  z.array(mappingEntry).min(1, "Choose at least one document").max(BULK_UPLOAD_MAX_FILES).superRefine((entries, ctx) => {
    const files = new Set<number>();
    const requirements = new Set<number>();
    for (const entry of entries) {
      if (files.has(entry.fileIndex)) ctx.addIssue({ code: "custom", message: "Each file can be matched to one requirement only" });
      if (requirements.has(entry.requirementId)) ctx.addIssue({ code: "custom", message: "Each requirement can take one file only" });
      files.add(entry.fileIndex);
      requirements.add(entry.requirementId);
    }
  })
);

export const taComplianceBulkSchema = {
  bulkUpload: z.object({
    params: z.object({ id: boundedIdText }).strict(),
    body: z.object({ mapping: mappingFromJson }).strict(),
  }),
};
