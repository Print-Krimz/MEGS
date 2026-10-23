import prisma from "../../utils/prisma.js";
import { uploadComplianceDocumentForApplicant } from "../applicant/application.service.js";

export interface BulkUploadEntry { fileIndex: number; requirementId: number }
export interface BulkUploadResult { requirementId: number; status: "uploaded" | "failed"; error?: string }

export class BulkUploadRequestError extends Error {}

/**
 * Stores several scanned documents against one application's requirements.
 * Each file goes through the single-upload path, so every document lands as SUBMITTED and is
 * audited on its own. Nothing is approved here, and one failed file does not undo the others.
 */
export const bulkUploadComplianceDocuments = async ({
  actor,
  applicationId,
  files,
  mapping,
}: {
  actor: { id: string; role: string };
  applicationId: number;
  files: Express.Multer.File[];
  mapping: BulkUploadEntry[];
}): Promise<BulkUploadResult[]> => {
  const mappedIndexes = new Set(mapping.map((entry) => entry.fileIndex));
  if (mapping.some((entry) => entry.fileIndex >= files.length) || files.some((_, index) => !mappedIndexes.has(index))) {
    throw new BulkUploadRequestError("Every file must be matched to a requirement.");
  }

  const ids = mapping.map((entry) => entry.requirementId);
  const owned = await prisma.complianceRequirement.findMany({ where: { id: { in: ids }, applicationId }, select: { id: true } });
  if (owned.length !== new Set(ids).size) {
    throw new BulkUploadRequestError("One of the requirements does not belong to this application.");
  }

  const results: BulkUploadResult[] = [];
  for (const entry of mapping) {
    try {
      await uploadComplianceDocumentForApplicant({ actor, requirementId: entry.requirementId, file: files[entry.fileIndex]! });
      results.push({ requirementId: entry.requirementId, status: "uploaded" });
    } catch (error) {
      results.push({ requirementId: entry.requirementId, status: "failed", error: error instanceof Error ? error.message : "Upload failed." });
    }
  }
  return results;
};
