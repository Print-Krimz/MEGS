import prisma from '../../utils/prisma.js';
import { uploadFileToSupabase } from '../../middleware/upload.middleware.js';

export const updateToOnboarding = async (applicationId: number, actorId?: string, reason?: string) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot onboard an archived application");

  if (["HIRED", "ONBOARDING"].includes(application.status)) {
    throw new Error(`Application is already in ${application.status} state`);
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: { status: "ONBOARDING" },
  });

  if (actorId) {
    await prisma.recruiterDecision.create({
      data: {
        applicationId,
        actorId,
        fromStatus: application.status,
        toStatus: "ONBOARDING",
        reason: reason || "Moved candidate to onboarding",
      },
    });
  }

  return updated;
};

export const savePostHireDocument = async (applicationId: number, label: string, file: any, notes?: string) => {
  if (!file) throw new Error("No file provided");
  if (!label) throw new Error("Label is required (e.g., 'Medical Certificate')");

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) throw new Error("Application not found");

  const folderPath = `post-hire/${applicationId}`;
  const fileUrl = await uploadFileToSupabase("applicant-assets", folderPath, file);

  return await prisma.postHireDocument.create({
    data: {
      applicationId,
      label,
      fileUrl,
      notes,
    },
  });
};

// Transitions status to HIRED and creates Vault201 record atomically in a transaction
export const executeHiring = async (applicationId: number, data: any, actorId?: string) => {
  const { employeeId, department, position, startDate, notes, reason } = data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { vault201: true },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot hire an archived application");
  if (application.vault201) throw new Error("This application already has a Vault201 record");

  return await prisma.$transaction(async (tx) => {
    const app = await tx.application.update({
      where: { id: applicationId },
      data: { status: "HIRED" },
    });

    const vault = await tx.vault201.create({
      data: {
        applicationId,
        employeeId,
        department,
        position,
        startDate: startDate ? new Date(startDate) : undefined,
        notes,
      },
    });

    if (actorId) {
      await tx.recruiterDecision.create({
        data: {
          applicationId,
          actorId,
          fromStatus: application.status,
          toStatus: "HIRED",
          reason: reason || "Hiring process completed and Vault201 created",
        },
      });
    }

    return { application: app, vault201: vault };
  });
};
