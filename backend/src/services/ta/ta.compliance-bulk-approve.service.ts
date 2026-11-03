import prisma from "../../utils/prisma.js";
import { DOCUMENT_VIEWED_ACTION } from "../../utils/audit.js";
import { REQUIREMENT_STAGES } from "./pipeline-rules.js";
import { reviewComplianceRequirement } from "./ta.compliance.service.js";

export interface BulkApproveEntry { requirementId: number; validityStatus: "HAS_EXPIRY" | "NO_EXPIRY"; expiresAt?: string | null }
export interface BulkApproveResult { requirementId: number; status: "approved" | "failed"; error?: string }

export class BulkApproveRequestError extends Error {}

/**
 * Approves several submitted documents of one application.
 * Every entry goes through the single-review path, so each approval is validated, audited, versioned and
 * notified on its own. One failed entry does not undo the others. Only a SUBMITTED requirement with a
 * file on record is approved here: rejected, approved, to-follow and empty rows are reported as failed.
 * The reviewer must also have opened the document (an audit record written by the preview and download
 * routes), and the write only lands if the row is still SUBMITTED with that same file.
 */
export const bulkApproveComplianceRequirements = async ({
  reviewerId,
  applicationId,
  entries,
  reviewNotes,
}: {
  reviewerId: string;
  applicationId: number;
  entries: BulkApproveEntry[];
  reviewNotes: string;
}): Promise<BulkApproveResult[]> => {
  const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true } });
  if (!application) throw new BulkApproveRequestError("Application not found.");
  if (!REQUIREMENT_STAGES.includes(application.status)) {
    throw new BulkApproveRequestError("Requirements open when the candidate reaches the Requirements stage.");
  }

  const ids = entries.map((entry) => entry.requirementId);
  const owned = await prisma.complianceRequirement.findMany({ where: { id: { in: ids }, applicationId }, select: { id: true } });
  if (owned.length !== new Set(ids).size) {
    throw new BulkApproveRequestError("One of the requirements does not belong to this application.");
  }

  const results: BulkApproveResult[] = [];
  for (const entry of entries) {
    try {
      // Read the row again right before approving, so a document that changed since the list loaded is not approved blind.
      const current = await prisma.complianceRequirement.findUnique({
        where: { id: entry.requirementId },
        select: { reviewStatus: true, documentId: true },
      });
      if (!current?.documentId) throw new Error("No document has been uploaded.");
      if (current.reviewStatus !== "SUBMITTED") throw new Error("This requirement is no longer waiting for review.");
      const opened = await prisma.auditLog.findFirst({
        where: { userId: reviewerId, action: DOCUMENT_VIEWED_ACTION, entity: "StoredDocument", entityId: current.documentId },
        select: { id: true },
      });
      if (!opened) throw new Error("Open the document before approving it.");
      await reviewComplianceRequirement(
        entry.requirementId,
        reviewerId,
        "APPROVED",
        reviewNotes,
        entry.validityStatus === "HAS_EXPIRY" ? entry.expiresAt : null,
        undefined,
        undefined,
        entry.validityStatus,
        { reviewStatus: "SUBMITTED", documentId: current.documentId }
      );
      results.push({ requirementId: entry.requirementId, status: "approved" });
    } catch (error) {
      results.push({ requirementId: entry.requirementId, status: "failed", error: error instanceof Error ? error.message : "Approval failed." });
    }
  }
  return results;
};
