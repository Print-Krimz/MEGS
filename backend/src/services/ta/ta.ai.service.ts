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
      jobPostingId: true,
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot analyze an archived application");
  if (!application.resumeUrl) throw new Error("This application has no resume attached");
  if (application.status === "BACKOUT") throw new Error("Cannot analyze an application that has backed out");

  // Only transition to PARSING if the application is in an initial un-reviewed status
  const transitionToParsingStatuses = ["SUBMITTED", "NEEDS_ATTENTION", "MATCHED"];
  if (transitionToParsingStatuses.includes(application.status)) {
    const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
    await updateTAApplicationStatus(applicationId, "PARSING", undefined, "Queued for AI resume parsing");
  }

  enqueueResumeAnalysis(applicationId);

  // Trigger candidate scoring revalidation in background
  if (application.jobPostingId) {
    const { revalidateApplication } = await import("../scoring/scoring-configuration.service.js");
    void revalidateApplication(applicationId, application.jobPostingId).catch((err) =>
      console.error("[AI Service] Failed to revalidate candidate score:", err)
    );
  }

  const queueStatus = getQueueStatus();

  return {
    applicationId,
    status: transitionToParsingStatuses.includes(application.status) ? "PARSING" : application.status,
    queueSize: queueStatus.size,
  };
};
