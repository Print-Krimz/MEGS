import prisma from '../../utils/prisma.js';
import { sendNotification } from '../../utils/notification.js';

export const fetchInterviews = async (applicationId: number) => {
  return await prisma.interview.findMany({
    where: { applicationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
};

// Schedules interview with a 7-day compliance deadline target
export const scheduleNewInterview = async (applicationId: number, type: any, scheduledAt: string, notes?: string) => {
  if (!["INITIAL_SCREENING", "FINAL_INTERVIEW"].includes(type)) {
    throw new Error("type must be INITIAL_SCREENING or FINAL_INTERVIEW");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true, isArchived: true, userId: true },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot schedule interview for archived application");

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);

  const interview = await prisma.interview.create({
    data: {
      applicationId,
      type,
      scheduledAt: new Date(scheduledAt),
      result: "PENDING",
      notes,
      complianceDeadline: deadline,
    },
  });

  sendNotification(
    application.userId,
    "Interview Scheduled",
    `Your ${type.replace("_", " ")} has been scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
    "INFO"
  );

  return interview;
};

// Records interview outcome; NO_SHOW automatically archives the application
export const updateInterviewResult = async (applicationId: number, interviewId: number, result: string, conductedAt?: string, notes?: string) => {
  if (!["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW", "PENDING"].includes(result)) {
    throw new Error("result must be PASS, PASSED, FAIL, FAILED, NO_SHOW, or PENDING");
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId, applicationId },
  });

  if (!interview) throw new Error("Interview not found");

  const updatedInterview = await prisma.interview.update({
    where: { id: interviewId },
    data: {
      result,
      conductedAt: conductedAt ? new Date(conductedAt) : undefined,
      notes: notes !== undefined ? notes : undefined,
      isCompliant: new Date() <= (interview.complianceDeadline || new Date()),
    },
  });

  let applicationUpdateMessage = "";
  if (result === "NO_SHOW") {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: "ARCHIVED",
        isArchived: true,
        archivedAt: new Date(),
      },
    });
    applicationUpdateMessage = " Application automatically moved to ARCHIVED due to NO_SHOW.";
  }

  return { updatedInterview, applicationUpdateMessage };
};

// Calculates elapsed days in current interview stage against the 7-day SLA
export const getInterviewComplianceReport = async () => {
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ["INITIAL_SCREENING", "FINAL_INTERVIEW"] },
      isArchived: false,
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      jobPosting: { select: { title: true } },
      user: { select: { applicantProfile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const complianceReport = applications.map(app => {
    const daysInStage = Math.floor((now.getTime() - app.updatedAt.getTime()) / ONE_DAY_MS);
    
    let slaStatus = "HEALTHY";
    if (daysInStage >= 7) slaStatus = "BREACHED";
    else if (daysInStage >= 5) slaStatus = "WARNING";

    return {
      applicationId: app.id,
      candidate: `${app.user.applicantProfile?.firstName} ${app.user.applicantProfile?.lastName}`,
      job: app.jobPosting.title,
      currentStage: app.status,
      enteredStageAt: app.updatedAt,
      daysInStage,
      slaStatus,
      daysUntilBreach: Math.max(0, 7 - daysInStage)
    };
  });

  return {
    summary: {
      total: complianceReport.length,
      breached: complianceReport.filter(r => r.slaStatus === "BREACHED").length,
      warning: complianceReport.filter(r => r.slaStatus === "WARNING").length,
      healthy: complianceReport.filter(r => r.slaStatus === "HEALTHY").length,
    },
    details: complianceReport
  };
};
