import prisma from "../../utils/prisma.js";

export const createComplianceRequirement = async (
  applicationId: number,
  documentLabel: string,
  isRequired: boolean = true,
  deadline?: string | Date
) => {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error("Application not found");

  return await prisma.complianceRequirement.create({
    data: {
      applicationId,
      documentLabel,
      isRequired,
      deadline: deadline ? new Date(deadline) : null,
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

export const submitDocumentForRequirement = async (requirementId: number, documentId: number) => {
  const requirement = await prisma.complianceRequirement.findUnique({ where: { id: requirementId } });
  if (!requirement) throw new Error("Compliance requirement not found");

  const doc = await prisma.storedDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Stored document not found");

  return await prisma.complianceRequirement.update({
    where: { id: requirementId },
    data: {
      documentId,
      reviewStatus: "SUBMITTED",
    },
  });
};

export const reviewComplianceRequirement = async (
  requirementId: number,
  reviewedById: string,
  reviewStatus: "APPROVED" | "REJECTED" | "PENDING",
  reviewNotes?: string
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

  return requiredList.every((req) => req.reviewStatus === "APPROVED");
};
