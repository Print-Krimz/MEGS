import prisma from '../../utils/prisma.js';
import { enqueueResumeAnalysis, getQueueStatus } from '../../workers/resume.worker.js';

// Transitions eligible application to PARSING and queues background analysis
export const queueApplicationAnalysis = async (applicationId: number) => {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      resumeUrl: true,
      isArchived: true,
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot analyze an archived application");
  if (!application.resumeUrl) throw new Error("This application has no resume attached");

  const queueableStatuses = ["SUBMITTED", "REVIEW", "NEEDS_ATTENTION", "MATCHED", "TALENT_POOL"];
  if (!queueableStatuses.includes(application.status)) {
    throw new Error(`Cannot analyze an application with status: ${application.status}. Eligible statuses: ${queueableStatuses.join(", ")}`);
  }

  const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
  await updateTAApplicationStatus(applicationId, "PARSING", undefined, "Queued for AI resume parsing");

  enqueueResumeAnalysis(applicationId);

  const queueStatus = getQueueStatus();

  return {
    applicationId,
    status: "PARSING",
    queueSize: queueStatus.size,
  };
};
