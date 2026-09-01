import prisma from "../../utils/prisma.js";
import { logAudit } from "../../utils/audit.js";
import { sendNotification } from "../../utils/notification.js";

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

  const resolvedDeadline = deadline
    ? new Date(deadline)
    : calculateDefaultComplianceDeadline();

  const req = await prisma.complianceRequirement.create({
    data: {
      applicationId,
      documentLabel: trimmedLabel,
      isRequired,
      deadline: resolvedDeadline,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
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

export const submitDocumentForRequirement = async (
  requirementId: number,
  documentId: number,
  expiresAt?: string | Date
) => {
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
  if (!requirement) throw new Error("Compliance requirement not found");

  const doc = await prisma.storedDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Stored document not found");

  return await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      documentId,
      reviewStatus: "SUBMITTED",
      ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
    },
  });
};

export const reviewComplianceRequirement = async (
  requirementId: number,
  reviewedById: string,
  reviewStatus: "APPROVED" | "REJECTED" | "PENDING" | "EXPIRED",
  reviewNotes?: string,
  expiresAt?: string | Date
) => {
  const requirement = await prisma.complianceRequirement.findUnique({
    where: { id: requirementId },
    include: {
      application: {
        select: {
          userId: true,
          jobPosting: { select: { postedById: true, title: true } },
        },
      },
    },
  });
  if (!requirement) throw new Error("Compliance requirement not found");

  const updated = await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      reviewStatus,
      reviewedById,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
    },
  });

  void logAudit(reviewedById, "COMPLIANCE_REQUIREMENT_REVIEWED", "Application", requirement.applicationId, {
    requirementId,
    documentLabel: requirement.documentLabel,
    reviewStatus,
    reviewNotes,
  });

  const isApproved = reviewStatus === "APPROVED";
  const notifTitle = isApproved ? "Compliance Document Approved" : "Compliance Document Rejected";
  const notifMsg = isApproved
    ? `Your document '${requirement.documentLabel}' has been verified and approved.`
    : `Your document '${requirement.documentLabel}' was rejected: ${reviewNotes || "Please review requirements and re-upload."}`;
  const notifType = isApproved ? "SUCCESS" : "WARNING";

  if (requirement.application?.userId) {
    void sendNotification(
      requirement.application.userId,
      notifTitle,
      notifMsg,
      notifType,
      `/app/applications/${requirement.applicationId}`
    );
  }

  const jobOwnerId = requirement.application?.jobPosting?.postedById;
  if (jobOwnerId && jobOwnerId !== reviewedById) {
    void sendNotification(
      jobOwnerId,
      `Compliance Document ${isApproved ? "Approved" : "Rejected"}`,
      `Document '${requirement.documentLabel}' was ${reviewStatus.toLowerCase()} by reviewer.`,
      notifType,
      `/ta/applications/${requirement.applicationId}`
    );
  }

  return updated;
};

export const isFullyCompliant = async (applicationId: number): Promise<boolean> => {
  const requiredList = await prisma.complianceRequirement.findMany({
    where: { applicationId, isRequired: true },
  });

  if (requiredList.length === 0) {
    // If no requirements defined yet, check postHireDocuments or default to compliant
    return true;
  }

  const now = new Date();
  return requiredList.every((req) => {
    if (req.reviewStatus !== "APPROVED") return false;
    if (req.expiresAt && req.expiresAt <= now) return false;
    return true;
  });
};

/**
 * Automatically generates compliance checklist requirements from MRF/Client templates
 * when a candidate transitions to COMPLIANCE or HIRED.
 */
export const calculateDefaultComplianceDeadline = (mrfTargetDate?: Date | null): Date => {
  const now = new Date();
  const defaultSla = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

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

  const parsedDeadline = deadline ? new Date(deadline) : null;
  if (deadline && isNaN(parsedDeadline!.getTime())) {
    throw new Error("Invalid deadline date format");
  }

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

export const generateComplianceRequirementsFromMRF = async (applicationId: number) => {
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

  if (!app || !app.jobPosting) return [];

  const existingLabels = new Set(app.complianceRequirements.map((r) => r.documentLabel.toLowerCase().trim()));
  const templatesToApply: { documentLabel: string; isRequired: boolean }[] = [];

  // 1. Check MRF templates
  if (app.jobPosting.mrf?.complianceTemplates?.length) {
    for (const tmpl of app.jobPosting.mrf.complianceTemplates) {
      if (!existingLabels.has(tmpl.documentLabel.toLowerCase().trim())) {
        templatesToApply.push({ documentLabel: tmpl.documentLabel, isRequired: tmpl.isRequired });
        existingLabels.add(tmpl.documentLabel.toLowerCase().trim());
      }
    }
  }

  // 2. Check Client templates
  if (app.jobPosting.mrf?.client?.complianceTemplates?.length) {
    for (const tmpl of app.jobPosting.mrf.client.complianceTemplates) {
      if (!existingLabels.has(tmpl.documentLabel.toLowerCase().trim())) {
        templatesToApply.push({ documentLabel: tmpl.documentLabel, isRequired: tmpl.isRequired });
        existingLabels.add(tmpl.documentLabel.toLowerCase().trim());
      }
    }
  }

  // 3. Check structured JSON string on MRF if any
  if (app.jobPosting.mrf?.complianceRequirements) {
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
    const defaultTemplates: { documentLabel: string; isRequired: boolean }[] = [
      { documentLabel: "Government Issued ID", isRequired: true },
      { documentLabel: "NBI Clearance", isRequired: true },
      { documentLabel: "Fit to Work Medical Exam", isRequired: true },
      { documentLabel: "SSS Document", isRequired: true },
      { documentLabel: "PhilHealth Member Data Record", isRequired: true },
      { documentLabel: "Pag-IBIG Member ID", isRequired: true },
      { documentLabel: "Signed Employment Contract", isRequired: true },
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

  const defaultDeadline = calculateDefaultComplianceDeadline(app.jobPosting.mrf?.targetFillDate);

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
      `Pre-employment compliance requirements (${created.length} items) have been assigned to your application.`,
      "INFO",
      `/app/applications/${applicationId}`
    );
  }

  return created;
};

