import { Prisma } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import { sendNotification } from "../../utils/notification.js";
import { isValidDateOnly, manilaDateString, parseManilaDateOnly, toManilaDateOnly } from "../../schemas/field-limits.js";
import { ownedWhere, type Actor } from "./ownership.js";
import { PIPELINE_STAGE_ORDER } from "./pipeline-rules.js";

const parseInputCalendarDate = (value: string | Date): Date => parseManilaDateOnly(toManilaDateOnly(value));

export const requestComplianceDocumentUpdate = async (requirementId: number, actorId: string, reason: string, deadline: string) => {
  if (!reason.trim() || !isValidDateOnly(deadline) || deadline < manilaDateString()) throw new Error("Provide a reason and a deadline today or in the future.");
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId }, include: { application: { select: { userId: true } } } });
  if (!requirement) throw new Error("Compliance requirement not found");
  const updated = await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: { reviewStatus: "PENDING", updateRequestedAt: new Date(), updateRequestReason: reason.trim(), updateRequestDeadline: parseManilaDateOnly(deadline), updateRequestCompletedAt: null },
  });
  await logAudit(actorId, "DOCUMENT_UPDATE_REQUESTED", "Application", requirement.applicationId, { requirementId, reason: reason.trim(), deadline });
  void sendNotification(requirement.application.userId, "Updated Document Requested", `Please upload an updated ${requirement.documentLabel} by ${deadline}: ${reason.trim()}`, "INFO", "/app/documents");
  return updated;
};

export const createComplianceRequirement = async (
  applicationId: number,
  documentLabel: string,
  isRequired: boolean = true,
  deadline?: string | Date,
  expiresAt?: string | Date,
  actorId?: string
) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { complianceRequirements: true },
  });
  if (!application) throw new Error("Application not found");

  const trimmedLabel = documentLabel?.trim();
  if (!trimmedLabel) {
    throw new Error("Document label is required.");
  }

  // Reject bundled multi-item strings (comma or semicolon separated)
  if (trimmedLabel.includes(",") || trimmedLabel.includes(";")) {
    throw new Error("Please create each compliance requirement individually rather than combining multiple items.");
  }

  // Enforce duplicate prevention (case-insensitive normalized matching)
  const normalizedLabel = trimmedLabel.toLowerCase();
  const duplicate = application.complianceRequirements.some(
    (r) => r.documentLabel.trim().toLowerCase() === normalizedLabel
  );
  if (duplicate) {
    throw new Error(`A compliance requirement for '${trimmedLabel}' already exists for this application.`);
  }

  const deadlineDay = deadline ? toManilaDateOnly(deadline) : undefined;
  if (deadlineDay && (!isValidDateOnly(deadlineDay) || deadlineDay < manilaDateString())) {
    throw new Error("Requirement deadline must be today or a future date.");
  }
  const resolvedDeadline = deadlineDay
    ? parseManilaDateOnly(deadlineDay)
    : calculateDefaultComplianceDeadline();

  const resolvedExpiry = expiresAt ? parseInputCalendarDate(expiresAt) : null;

  const req = await prisma.complianceRequirement.create({
    data: {
      applicationId,
      documentLabel: trimmedLabel,
      isRequired,
      deadline: resolvedDeadline,
      expiresAt: resolvedExpiry,
      reviewStatus: "PENDING",
    },
  });

  void logAudit(actorId || application.userId, "COMPLIANCE_REQUIREMENT_CREATED", "Application", applicationId, {
    requirementId: req.id,
    documentLabel: trimmedLabel,
    isRequired,
  });

  if (application.userId) {
    void sendNotification(
      application.userId,
      "New Compliance Requirement",
      `A new document requirement '${trimmedLabel}' has been added to your application.`,
      "INFO",
      `/app/applications/${applicationId}`
    );
  }

  return req;
};

export const listComplianceRequirements = async (applicationId: number) => {
  const reqs = await prisma.complianceRequirement.findMany({
    where: { applicationId },
    include: {
      reviewedBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Auto-backfill 7-day deadline for any legacy requirements that lacked one
  for (const r of reqs) {
    if (!r.deadline) {
      const autoDeadline = new Date(r.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      r.deadline = autoDeadline;
      void prisma.complianceRequirement.update({
        where: { id: r.id },
        data: { deadline: autoDeadline },
      }).catch(() => {});
    }
  }

  return reqs;
};


export const deleteComplianceRequirement = async (
  requirementId: number,
  actorId?: string
) => {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: { application: true },
  });
  if (!requirement) {
    throw new Error("Compliance requirement not found");
  }

  // Requirements gate Contract Signing; nothing is removed from Contract Signing onward.
  // (TA-added ad-hoc items are saved as required, so isRequired is not used to block earlier cleanup.)
  const stageOrder = PIPELINE_STAGE_ORDER as readonly string[];
  const atOrPastContractSigning = stageOrder.indexOf(requirement.application.status) >= stageOrder.indexOf("CONTRACT_SIGNING");
  if (atOrPastContractSigning) {
    throw new Error("This requirement can't be removed at the current stage.");
  }

  await prisma.complianceRequirement.delete({
    where: { id: requirementId },
  });

  if (requirement.applicationId) {
    void logAudit(actorId || requirement.application?.userId, "COMPLIANCE_REQUIREMENT_DELETED", "Application", requirement.applicationId, {
      requirementId,
      documentLabel: requirement.documentLabel,
    });
  }

  return { id: requirementId, success: true };
};

export const submitDocumentForRequirement = async (
  requirementId: number,
  documentId: number,
  expiresAt?: string | Date
) => {
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
  if (!requirement) throw new Error("Compliance requirement not found");

  const doc = await prisma.storedDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Stored document not found");
  const application = await prisma.application.findUnique({ where: { id: requirement.applicationId }, select: { userId: true } });
  if (!application || doc.ownerId !== application.userId) throw new Error("This document does not belong to the applicant on this requirement.");

  return await prisma.$transaction(async (tx) => {
    if (requirement.documentId) {
      await tx.complianceDocumentVersion.updateMany({
        where: { requirementId, isCurrent: true },
        data: { isCurrent: false },
      });
    }
    await tx.complianceDocumentVersion.create({
      data: {
        requirementId,
        documentId,
        validityStatus: "UNKNOWN",
        reviewStatus: "SUBMITTED",
      },
    });
    return tx.complianceRequirement.update({
      where: { id: requirementId },
      data: { documentId, reviewStatus: "SUBMITTED", issuedAt: null, expiresAt: null, validityStatus: "UNKNOWN" },
    });
  });
};

export const reviewComplianceRequirement = async (
  requirementId: number,
  reviewedById: string,
  reviewStatus: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "TO_FOLLOW",
  reviewNotes?: string,
  expiresAt?: string | Date | null,
  toFollowExpectedAt?: string | Date | null,
  issuedAt?: string | Date | null,
  validityStatus?: "UNKNOWN" | "HAS_EXPIRY" | "NO_EXPIRY"
) => {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: {
      application: {
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              email: true,
              applicantProfile: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          jobPosting: {
            select: {
              postedById: true,
              title: true,
              mrf: {
                select: {
                  clientId: true,
                  client: {
                    select: {
                      id: true,
                      medicalValidityMonths: true,
                      reviewThresholdDays: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!requirement) throw new Error("Compliance requirement not found");
  if (reviewStatus === "REJECTED" && !reviewNotes?.trim()) {
    throw new Error("Please add a note explaining why this was rejected.");
  }

  const followDay = toFollowExpectedAt ? toManilaDateOnly(toFollowExpectedAt) : undefined;
  if (reviewStatus === "APPROVED" && !requirement.documentId) {
    throw new Error("Upload a document before approving this requirement.");
  }
  if (reviewStatus === "APPROVED" && requirement.updateRequestedAt && !requirement.updateRequestCompletedAt && requirement.reviewStatus !== "SUBMITTED") {
    throw new Error("Wait for the applicant to submit the requested updated copy before approving it.");
  }
  // To follow means the file is still missing; a requirement that already has one is approved or rejected.
  if (reviewStatus === "TO_FOLLOW" && requirement.documentId && requirement.reviewStatus !== "TO_FOLLOW") {
    throw new Error("This requirement already has an uploaded document. Approve or reject it instead of marking it to follow.");
  }
  const previousFollowDay = requirement.toFollowExpectedAt ? toManilaDateOnly(requirement.toFollowExpectedAt) : undefined;
  if (reviewStatus === "TO_FOLLOW" && followDay && followDay < manilaDateString() && followDay !== previousFollowDay) {
    throw new Error("Follow-up target date must be today or a future date.");
  }

  const resolvedIssuedAt = issuedAt !== undefined ? (issuedAt ? parseInputCalendarDate(issuedAt) : null) : undefined;
  let calculatedExpiresAt: Date | null | undefined =
    expiresAt !== undefined ? (expiresAt ? parseInputCalendarDate(expiresAt) : null) : undefined;
  let resolvedValidityStatus = validityStatus;
  if (expiresAt) resolvedValidityStatus = "HAS_EXPIRY";
  if (validityStatus === "NO_EXPIRY") calculatedExpiresAt = null;

  const isMedicalDoc = Boolean(
    requirement.documentLabel &&
      /medical|fit\s+to\s+work|health/i.test(requirement.documentLabel)
  );

  if (reviewStatus === "APPROVED" && !expiresAt && isMedicalDoc && validityStatus !== "NO_EXPIRY") {
    if (!issuedAt) throw new Error("Enter the issue date so the medical document’s validity can be calculated.");
    const validityMonths =
      requirement.application?.jobPosting?.mrf?.client?.medicalValidityMonths ?? 6;
    const exp = new Date(resolvedIssuedAt!);
    exp.setMonth(exp.getMonth() + validityMonths);
    calculatedExpiresAt = exp;
    resolvedValidityStatus = "HAS_EXPIRY";
  }

  if (reviewStatus === "APPROVED") {
    const effectiveValidity = resolvedValidityStatus ?? requirement.validityStatus;
    if (!effectiveValidity || effectiveValidity === "UNKNOWN") {
      throw new Error("Choose whether the document has an expiry date before approving it.");
    }
    if (effectiveValidity === "HAS_EXPIRY") {
      const effectiveExpiry = calculatedExpiresAt !== undefined ? calculatedExpiresAt : requirement.expiresAt;
      if (!effectiveExpiry) throw new Error("Enter the expiry date before approving a document that expires.");
    }
  }

  const today = manilaDateString();
  if (issuedAt && toManilaDateOnly(issuedAt) > today) throw new Error("Issue date can't be in the future.");
  const effectiveIssuedAt = resolvedIssuedAt !== undefined ? resolvedIssuedAt : requirement.issuedAt;
  const effectiveExpiresAt = calculatedExpiresAt !== undefined ? calculatedExpiresAt : requirement.expiresAt;
  if (
    (issuedAt !== undefined || expiresAt !== undefined) &&
    effectiveIssuedAt && effectiveExpiresAt &&
    toManilaDateOnly(effectiveExpiresAt) < toManilaDateOnly(effectiveIssuedAt)
  ) {
    throw new Error("Expiry date can't be before the issue date.");
  }
  // Re-approving an already approved row is only checked when its expiry is being changed, so unrelated edits to old rows still save.
  const expiryChanged = calculatedExpiresAt !== undefined && calculatedExpiresAt?.getTime() !== requirement.expiresAt?.getTime();
  if (
    reviewStatus === "APPROVED" &&
    effectiveExpiresAt && (requirement.reviewStatus !== "APPROVED" || expiryChanged) &&
    toManilaDateOnly(effectiveExpiresAt) < today
  ) {
    throw new Error("This document has already expired. Ask the applicant for a current copy.");
  }

  const updateData: any = {
    reviewStatus,
    reviewedById,
    reviewNotes: reviewNotes || null,
    reviewedAt: new Date(),
    ...(reviewStatus === "APPROVED" && requirement.updateRequestedAt ? { updateRequestCompletedAt: new Date() } : {}),
    ...(resolvedIssuedAt !== undefined ? { issuedAt: resolvedIssuedAt } : {}),
    ...(resolvedValidityStatus !== undefined ? { validityStatus: resolvedValidityStatus } : {}),
    ...(calculatedExpiresAt !== undefined ? { expiresAt: calculatedExpiresAt } : {}),
  };

  if (reviewStatus === "TO_FOLLOW") {
    updateData.toFollowExpectedAt = followDay ? parseManilaDateOnly(followDay) : null;
  } else if (toFollowExpectedAt !== undefined) {
    updateData.toFollowExpectedAt = followDay ? parseManilaDateOnly(followDay) : null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextRequirement = await tx.complianceRequirement.update({
      where: { id: requirementId },
      data: updateData,
    });
    if (requirement.documentId && reviewStatus !== "PENDING") {
      await tx.complianceDocumentVersion.upsert({
        where: { requirementId_documentId: { requirementId, documentId: requirement.documentId } },
        create: {
          requirementId,
          documentId: requirement.documentId,
          issuedAt: resolvedIssuedAt ?? requirement.issuedAt,
          expiresAt: calculatedExpiresAt !== undefined ? calculatedExpiresAt : requirement.expiresAt,
          validityStatus: resolvedValidityStatus ?? requirement.validityStatus,
          reviewStatus,
          reviewNotes: reviewNotes || null,
          reviewedById,
          reviewedAt: new Date(),
          isCurrent: true,
        },
        update: {
          ...(resolvedIssuedAt !== undefined ? { issuedAt: resolvedIssuedAt } : {}),
          ...(calculatedExpiresAt !== undefined ? { expiresAt: calculatedExpiresAt } : {}),
          ...(resolvedValidityStatus !== undefined ? { validityStatus: resolvedValidityStatus } : {}),
          reviewStatus,
          reviewNotes: reviewNotes || null,
          reviewedById,
          reviewedAt: new Date(),
          isCurrent: true,
        },
      });
    }
    return nextRequirement;
  });

  void logAudit(reviewedById, "COMPLIANCE_REQUIREMENT_REVIEWED", "Application", requirement.applicationId, {
    requirementId,
    documentLabel: requirement.documentLabel,
    previousStatus: requirement.reviewStatus,
    reviewStatus,
    reviewNotes,
    toFollowExpectedAt: updateData.toFollowExpectedAt,
    expiresAt: updateData.expiresAt,
  });

  const candProfile = requirement.application?.user?.applicantProfile;
  const candidateName = (candProfile?.firstName || candProfile?.lastName)
    ? `${candProfile.firstName || ""} ${candProfile.lastName || ""}`.trim()
    : requirement.application?.user?.email || "Candidate";
  const jobTitle = requirement.application?.jobPosting?.title || "Requisition";

  const isApproved = reviewStatus === "APPROVED";
  const isToFollow = reviewStatus === "TO_FOLLOW";
  const isUpdateRequested = reviewStatus === "PENDING";
  const notifTitle = isApproved
    ? "Compliance Document Approved"
    : isToFollow
    ? "Compliance Document Marked To Follow"
    : isUpdateRequested
    ? "Updated Document Requested"
    : "Compliance Document Rejected";
  const notifMsg = isApproved
    ? `Your document '${requirement.documentLabel}' for "${jobTitle}" has been verified and approved.`
    : isToFollow
    ? `Your document '${requirement.documentLabel}' for "${jobTitle}" has been marked to follow${
        updateData.toFollowExpectedAt
          ? ` with target completion date ${new Date(updateData.toFollowExpectedAt).toLocaleDateString()}`
          : ""
      }.`
    : isUpdateRequested
    ? `Please upload an updated ${requirement.documentLabel}${reviewNotes ? `: ${reviewNotes}` : "."}`
    : `Your document '${requirement.documentLabel}' for "${jobTitle}" was rejected: ${reviewNotes || "Please review requirements and re-upload."}`;
  const notifType = isApproved ? "SUCCESS" : isToFollow || isUpdateRequested ? "INFO" : "WARNING";

  if (requirement.application?.userId) {
    void sendNotification(
      requirement.application.userId,
      notifTitle,
      notifMsg,
      notifType,
      `/app/applications/${requirement.applicationId}`,
      {
        sendEmail: true,
        ctaText: isApproved || isToFollow ? "View Application" : "Upload Document",
      }
    );
  }

  const jobOwnerId = requirement.application?.jobPosting?.postedById;
  if (jobOwnerId && jobOwnerId !== reviewedById) {
    void sendNotification(
      jobOwnerId,
      `Compliance Document ${isApproved ? "Approved" : isToFollow ? "To Follow" : "Rejected"}`,
      `Document '${requirement.documentLabel}' for ${candidateName} on "${jobTitle}" was marked as ${reviewStatus.toLowerCase()} by reviewer.`,
      notifType,
      `/ta/applications/${requirement.applicationId}`
    );
  }

  // If approved or TO_FOLLOW, check if all mandatory requirements are satisfied
  if (isApproved || isToFollow) {
    const compliant = await isFullyCompliant(requirement.applicationId);
    if (compliant) {
      if (requirement.application?.userId) {
        void sendNotification(
          requirement.application.userId,
          "Pre-Employment Requirements Complete",
          "All mandatory compliance documents approved or scheduled to follow. Ready for contract signing.",
          "SUCCESS",
          `/app/applications/${requirement.applicationId}`,
          {
            sendEmail: true,
            ctaText: "View Application",
          }
        );
      }

      if (jobOwnerId) {
        void sendNotification(
          jobOwnerId,
          "Candidate Compliance Complete",
          `${candidateName} on "${jobTitle}" has completed or scheduled all mandatory compliance documents and is ready for contract signing.`,
          "SUCCESS",
          `/ta/applications/${requirement.applicationId}`
        );
      }
    }
  }

  return updated;
};

export const isFullyCompliant = async (applicationId: number): Promise<boolean> => {
  const requiredList = await prisma.complianceRequirement.findMany({
    where: { applicationId, isRequired: true },
  });

  if (requiredList.length === 0) {
    // If no compliance requirements exist yet, the candidate is not compliant
    return false;
  }

  const now = new Date();
  return requiredList.every((req) => {
    if (req.reviewStatus === "APPROVED") {
      return req.validityStatus === "NO_EXPIRY" || (
        req.validityStatus === "HAS_EXPIRY" && Boolean(req.expiresAt && req.expiresAt > now)
      );
    }
    if (req.reviewStatus === "TO_FOLLOW") {
      // Per resolved client decision: deployment permitted while tracking pending requirement
      return true;
    }
    return false;
  });
};

/**
 * Automatically generates compliance checklist requirements from MRF/Client templates
 * when a candidate transitions to COMPLIANCE or HIRED.
 */
export const calculateDefaultComplianceDeadline = (
  mrfTargetDate?: Date | null,
  reviewThresholdDays: number = 5
): Date => {
  const now = new Date();
  const defaultSla = new Date(now.getTime() + reviewThresholdDays * 24 * 60 * 60 * 1000);

  if (mrfTargetDate) {
    const target = new Date(mrfTargetDate);
    // If target date is valid and in the future, if it is sooner than 7 days, align with target
    if (!isNaN(target.getTime()) && target.getTime() > now.getTime()) {
      if (target.getTime() < defaultSla.getTime()) {
        return target;
      }
    }
  }

  return defaultSla;
};

export const updateComplianceRequirementDeadline = async (
  requirementId: number,
  deadline: string | Date | null,
  actorId?: string
) => {
  const existing = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: { application: true },
  });
  if (!existing) throw new Error("Compliance requirement not found");

  const deadlineDay = deadline ? toManilaDateOnly(deadline) : null;
  const existingDay = existing.deadline ? toManilaDateOnly(existing.deadline) : null;
  if (deadlineDay && (!isValidDateOnly(deadlineDay) ||
      (deadlineDay < manilaDateString() && deadlineDay !== existingDay))) {
    throw new Error("Requirement deadline must be today or a future date.");
  }
  const parsedDeadline = deadlineDay ? parseManilaDateOnly(deadlineDay) : null;

  const updated = await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      deadline: parsedDeadline,
    },
  });

  void logAudit(
    actorId || existing.application.userId,
    "COMPLIANCE_REQUIREMENT_DEADLINE_UPDATED",
    "ComplianceRequirement",
    requirementId,
    {
      previousDeadline: existing.deadline,
      newDeadline: parsedDeadline,
      documentLabel: existing.documentLabel,
      applicationId: existing.applicationId,
    }
  );

  return updated;
};

export interface ResolvedComplianceTemplate {
  documentLabel: string;
  isRequired: boolean;
}

export interface ResolvedComplianceResult {
  app: any;
  templatesToApply: ResolvedComplianceTemplate[];
  defaultDeadline: Date;
  source: "MRF_TEMPLATE" | "CLIENT_TEMPLATE" | "MRF_CUSTOM_REQUIREMENTS" | "STANDARD_DEFAULTS" | "NONE";
}

export const resolveComplianceTemplatesForApplication = async (
  applicationId: number
): Promise<ResolvedComplianceResult> => {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      jobPosting: {
        include: {
          mrf: {
            include: {
              complianceTemplates: true,
              client: {
                include: {
                  complianceTemplates: true,
                },
              },
            },
          },
        },
      },
      complianceRequirements: true,
    },
  });

  if (!app || !app.jobPosting) {
    return {
      app: null,
      templatesToApply: [],
      defaultDeadline: new Date(),
      source: "NONE",
    };
  }

  const existingLabels = new Set(app.complianceRequirements.map((r) => r.documentLabel.toLowerCase().trim()));
  const templatesToApply: ResolvedComplianceTemplate[] = [];
  let source: ResolvedComplianceResult["source"] = "STANDARD_DEFAULTS";

  // 1. Check MRF templates
  if (app.jobPosting.mrf?.complianceTemplates?.length) {
    source = "MRF_TEMPLATE";
    for (const tmpl of app.jobPosting.mrf.complianceTemplates) {
      if (!existingLabels.has(tmpl.documentLabel.toLowerCase().trim())) {
        templatesToApply.push({ documentLabel: tmpl.documentLabel, isRequired: tmpl.isRequired });
        existingLabels.add(tmpl.documentLabel.toLowerCase().trim());
      }
    }
  }

  // 2. Check Client templates
  if (app.jobPosting.mrf?.client?.complianceTemplates?.length) {
    if (source === "STANDARD_DEFAULTS") source = "CLIENT_TEMPLATE";
    for (const tmpl of app.jobPosting.mrf.client.complianceTemplates) {
      if (!existingLabels.has(tmpl.documentLabel.toLowerCase().trim())) {
        templatesToApply.push({ documentLabel: tmpl.documentLabel, isRequired: tmpl.isRequired });
        existingLabels.add(tmpl.documentLabel.toLowerCase().trim());
      }
    }
  }

  // 3. Check structured JSON string on MRF if any
  if (app.jobPosting.mrf?.complianceRequirements) {
    if (source === "STANDARD_DEFAULTS") source = "MRF_CUSTOM_REQUIREMENTS";
    try {
      const parsed = JSON.parse(app.jobPosting.mrf.complianceRequirements);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const label = typeof item === "string" ? item : item.label || item.documentLabel;
          const isRequired = typeof item === "object" && item.isRequired !== undefined ? item.isRequired : true;
          if (label && !existingLabels.has(label.toLowerCase().trim())) {
            templatesToApply.push({ documentLabel: label, isRequired });
            existingLabels.add(label.toLowerCase().trim());
          }
        }
      }
    } catch {
      // Comma-separated fallback
      const parts = app.jobPosting.mrf.complianceRequirements.split(",").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        if (!existingLabels.has(part.toLowerCase())) {
          templatesToApply.push({ documentLabel: part, isRequired: true });
          existingLabels.add(part.toLowerCase());
        }
      }
    }
  }

  // If no specific template exists, create standard default compliance items
  if (templatesToApply.length === 0 && app.complianceRequirements.length === 0) {
    source = "STANDARD_DEFAULTS";
    const defaultTemplates: ResolvedComplianceTemplate[] = [
      { documentLabel: "Government Issued ID", isRequired: true },
      { documentLabel: "NBI Clearance", isRequired: true },
      { documentLabel: "Fit to Work Medical Exam", isRequired: true },
      { documentLabel: "SSS Document", isRequired: true },
      { documentLabel: "PhilHealth Member Data Record", isRequired: true },
      { documentLabel: "Pag-IBIG Member ID", isRequired: true },
    ];
    if (app.jobPosting.mrf?.clientId || app.jobPosting.mrf?.client) {
      defaultTemplates.push({ documentLabel: "Client NDA & Security Briefing", isRequired: true });
    }
    for (const dt of defaultTemplates) {
      if (!existingLabels.has(dt.documentLabel.toLowerCase().trim())) {
        templatesToApply.push(dt);
        existingLabels.add(dt.documentLabel.toLowerCase().trim());
      }
    }
  }

  const thresholdDays = app.jobPosting.mrf?.client?.reviewThresholdDays ?? 5;
  const defaultDeadline = calculateDefaultComplianceDeadline(app.jobPosting.mrf?.targetFillDate, thresholdDays);

  return { app, templatesToApply, defaultDeadline, source };
};

export const generateComplianceRequirementsFromMRF = async (applicationId: number) => {
  const { app, templatesToApply, defaultDeadline } = await resolveComplianceTemplatesForApplication(applicationId);

  if (!app || !app.jobPosting) return [];

  const created = [];
  for (const item of templatesToApply) {
    const rec = await prisma.complianceRequirement.create({
      data: {
        applicationId,
        documentLabel: item.documentLabel,
        isRequired: item.isRequired,
        deadline: defaultDeadline,
        reviewStatus: "PENDING",
      },
    });
    created.push(rec);
  }

  if (created.length > 0 && app.userId) {
    void sendNotification(
      app.userId,
      "Pre-Employment Checklist Available",
      'Pre-employment compliance requirements (' + created.length + ' items) have been assigned to your application.',
      "INFO",
      '/app/applications/' + applicationId
    );
  }

  return created;
};

export const reuseValidSameClientDocuments = async (applicationId: number, priorApplicationIds: number[]) => {
  if (priorApplicationIds.length === 0) return 0;
  const [newRequirements, previousRequirements] = await Promise.all([
    prisma.complianceRequirement.findMany({ where: { applicationId } }),
    prisma.complianceRequirement.findMany({
      where: {
        applicationId: { in: priorApplicationIds },
        reviewStatus: "APPROVED",
        documentId: { not: null },
        OR: [
          { validityStatus: "NO_EXPIRY" },
          { validityStatus: "HAS_EXPIRY", expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { reviewedAt: "desc" },
    }),
  ]);
  const latestByLabel = new Map<string, (typeof previousRequirements)[number]>();
  for (const previous of previousRequirements) {
    const normalizedLabel = previous.documentLabel.trim().toLowerCase();
    if (!latestByLabel.has(normalizedLabel)) latestByLabel.set(normalizedLabel, previous);
  }
  let reusedCount = 0;
  for (const requirement of newRequirements) {
    const previous = latestByLabel.get(requirement.documentLabel.trim().toLowerCase());
    if (!previous?.documentId) continue;
    const documentId = previous.documentId;
    await prisma.$transaction(async (tx) => {
      await tx.complianceRequirement.update({
        where: { id: requirement.id },
        data: {
          documentId,
          reviewStatus: "APPROVED",
          issuedAt: previous.issuedAt,
          expiresAt: previous.expiresAt,
          validityStatus: previous.validityStatus,
          reviewedById: previous.reviewedById,
          reviewedAt: new Date(),
          reviewNotes: `Reused from a current approved document for the same client (application #${previous.applicationId}).`,
        },
      });
      await tx.complianceDocumentVersion.create({
        data: {
          requirementId: requirement.id,
          documentId,
          issuedAt: previous.issuedAt,
          expiresAt: previous.expiresAt,
          validityStatus: previous.validityStatus,
          reviewStatus: "APPROVED",
          reviewNotes: `Reused from application #${previous.applicationId} for the same client.`,
          reviewedById: previous.reviewedById,
          reviewedAt: new Date(),
        },
      });
    });
    reusedCount += 1;
  }
  return reusedCount;
};

export type ComplianceScope = "PRE_DEPLOYMENT" | "POST_DEPLOYMENT" | "ALL";

/**
 * Post-deployment follow-ups: requirements marked To Follow, plus deferred ones (they carry a follow-up
 * target date, or an open updated-copy request) whose new upload awaits review or was rejected. Approved and never-deferred items are excluded.
 */
export const POST_DEPLOYMENT_FOLLOW_UP_WHERE: Prisma.ComplianceRequirementWhereInput = {
  OR: [
    { reviewStatus: "TO_FOLLOW" },
    { toFollowExpectedAt: { not: null }, reviewStatus: { in: ["SUBMITTED", "REJECTED", "PENDING"] } },
    // An updated copy requested from the 201 records stays here until the new copy is approved.
    { updateRequestedAt: { not: null }, updateRequestCompletedAt: null, reviewStatus: { in: ["SUBMITTED", "REJECTED", "PENDING"] } },
  ],
};

export const getScopedComplianceApplications = async (scope: ComplianceScope = "ALL", actor?: Actor) => {
  const whereClause: Prisma.ApplicationWhereInput = {
    isArchived: false,
    ...(actor ? (ownedWhere.application(actor) as Prisma.ApplicationWhereInput) : {}),
  };

  if (scope === "PRE_DEPLOYMENT") {
    whereClause.status = { in: ["COMPLIANCE", "CONTRACT_SIGNING"] };
  } else if (scope === "POST_DEPLOYMENT") {
    whereClause.status = "DEPLOYED";
    whereClause.complianceRequirements = { some: POST_DEPLOYMENT_FOLLOW_UP_WHERE };
  }

  return await prisma.application.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          applicantProfile: {
            select: { firstName: true, lastName: true, middleName: true, mobileNumber: true },
          },
          employee: {
            select: { id: true, employeeNumber: true, status: true },
          },
        },
      },
      jobPosting: {
        select: {
          id: true,
          title: true,
          mrf: {
            select: {
              id: true,
              title: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
      },
      deployments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { contractStart: "desc" },
      },
      complianceRequirements: {
        ...(scope === "POST_DEPLOYMENT" ? { where: POST_DEPLOYMENT_FOLLOW_UP_WHERE } : {}),
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
};
