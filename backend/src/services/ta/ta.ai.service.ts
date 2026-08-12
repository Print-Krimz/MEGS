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

  const queueableStatuses = ["SUBMITTED", "MATCHED", "TALENT_POOL"];
  if (!queueableStatuses.includes(application.status)) {
    throw new Error(`Cannot analyze an application with status: ${application.status}. Eligible statuses: ${queueableStatuses.join(", ")}`);
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: "PARSING" },
  });

  enqueueResumeAnalysis(applicationId);

  const queueStatus = getQueueStatus();

  return {
    applicationId,
    status: "PARSING",
    queueSize: queueStatus.size,
  };
};
