import prisma from "../../utils/prisma.js";

export const createComplianceRequirement = async (
  applicationId: number,
  documentLabel: string,
  isRequired: boolean = true,
  deadline?: string | Date,
  expiresAt?: string | Date
) => {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found");

  return await prisma.complianceRequirement.create({
    data: {
      applicationId,
      documentLabel,
      isRequired,
      deadline: deadline ? new Date(deadline) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reviewStatus: "PENDING",
    },
  });
};

export const listComplianceRequirements = async (applicationId: number) => {
  return await prisma.complianceRequirement.findMany({
    where: { applicationId },
    include: {
      reviewedBy: {
        select: { id: true, email: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
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
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
  if (!requirement) throw new Error("Compliance requirement not found");

  return await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      reviewStatus,
      reviewedById,
      reviewNotes: reviewNotes || null,
      reviewedAt: new Date(),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
    },
  });
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
    const defaultTemplates = [
      { documentLabel: "Government Issued ID", isRequired: true },
      { documentLabel: "NBI / Police Clearance", isRequired: true },
      { documentLabel: "Medical Certificate / PEME (Fit-to-Work)", isRequired: true },
      { documentLabel: "Signed Employment Contract", isRequired: true },
    ];
    for (const dt of defaultTemplates) {
      templatesToApply.push(dt);
    }
  }

  const created = [];
  for (const item of templatesToApply) {
    const rec = await prisma.complianceRequirement.create({
      data: {
        applicationId,
        documentLabel: item.documentLabel,
        isRequired: item.isRequired,
        reviewStatus: "PENDING",
      },
    });
    created.push(rec);
  }

  return created;
};

