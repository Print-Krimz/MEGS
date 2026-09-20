import prisma from '../../utils/prisma.js';
import { sendNotification } from '../../utils/notification.js';
import { logAudit } from '../../utils/audit.js';

export const fetchInterviews = async (applicationId: number) => {
  return await prisma.interview.findMany({
    where: { applicationId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
};

// Schedules interview with a 7-day compliance deadline target and validates pipeline stage constraints
export const scheduleNewInterview = async (
  applicationId: number,
  type: any,
  scheduledAt: string,
  notes?: string,
  actorId?: string
) => {
  if (!["INITIAL_SCREENING", "FINAL_INTERVIEW"].includes(type)) {
    throw new Error("type must be INITIAL_SCREENING or FINAL_INTERVIEW");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      isArchived: true,
      userId: true,
      jobPosting: { select: { id: true, title: true, postedById: true } },
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot schedule interview for archived application");

  const invalidStages = ["COMPLIANCE", "DEPLOYED", "ARCHIVED", "BACKOUT"];
  if (invalidStages.includes(application.status)) {
    throw new Error(`Cannot schedule interview for application in ${application.status} stage.`);
  }

  if (type === "INITIAL_SCREENING") {
    const screeningStages = ["SUBMITTED", "PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION", "TALENT_POOL"];
    if (!screeningStages.includes(application.status)) {
      throw new Error(`Cannot schedule INITIAL_SCREENING interview for application currently in ${application.status} stage.`);
    }

    // Advance application status to INITIAL_SCREENING if in pre-screening stages
    if (application.status !== "INITIAL_SCREENING") {
      const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
      await updateTAApplicationStatus(
        applicationId,
        "INITIAL_SCREENING",
        actorId,
        notes || "Initial screening interview scheduled"
      );
    }
  } else if (type === "FINAL_INTERVIEW") {
    // FINAL_INTERVIEW requires that the candidate passed Initial Screening and has an approved client endorsement
    const screening = await prisma.interview.findFirst({
      where: {
        applicationId,
        type: "INITIAL_SCREENING",
        result: { in: ["PASS", "PASSED"] },
        isActive: true,
      },
    });
    if (!screening) {
      throw new Error("Cannot schedule FINAL_INTERVIEW. Candidate must first complete and pass INITIAL_SCREENING.");
    }

    const endorsement = await prisma.clientEndorsement.findFirst({
      where: {
        applicationId,
        outcome: { notIn: ["DECLINED", "REJECTED"] },
      },
    });
    if (!endorsement) {
      throw new Error("Cannot schedule FINAL_INTERVIEW. Client endorsement dispatch is required.");
    }

    const finalStages = ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW"];
    if (!finalStages.includes(application.status)) {
      throw new Error(`Cannot schedule FINAL_INTERVIEW for application currently in ${application.status} stage.`);
    }

    // Advance application status to FINAL_INTERVIEW if in CLIENT_ENDORSEMENT
    if (application.status !== "FINAL_INTERVIEW") {
      const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
      await updateTAApplicationStatus(
        applicationId,
        "FINAL_INTERVIEW",
        actorId,
        notes || "Final client interview scheduled"
      );
    }
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 7);

  // Check if an existing pending interview of this type exists for this application
  const existingPending = await prisma.interview.findFirst({
    where: {
      applicationId,
      type,
      result: { in: ["PENDING", "SCHEDULED"] },
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let interview;
  if (existingPending) {
    interview = await prisma.interview.update({
      where: { id: existingPending.id },
      data: {
        scheduledAt: new Date(scheduledAt),
        notes: notes !== undefined ? notes : existingPending.notes,
        complianceDeadline: deadline,
        result: "PENDING",
      },
    });

    sendNotification(
      application.userId,
      "Interview Rescheduled",
      `Your ${type.replace("_", " ")} has been rescheduled to ${new Date(scheduledAt).toLocaleString()}.`,
      "INFO",
      `/app/applications/${applicationId}`
    );

    void logAudit(actorId || application.userId, "INTERVIEW_RESCHEDULED", "Application", applicationId, {
      interviewId: interview.id,
      type,
      previousScheduledAt: existingPending.scheduledAt,
      newScheduledAt: scheduledAt,
      notes,
    });
  } else {
    interview = await prisma.interview.create({
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
      "INFO",
      `/app/applications/${applicationId}`
    );

    void logAudit(actorId || application.userId, "INTERVIEW_SCHEDULED", "Application", applicationId, {
      interviewId: interview.id,
      type,
      scheduledAt,
      notes,
    });
  }

  const jobOwnerId = (application as any).jobPosting?.postedById;
  const jobTitle = (application as any).jobPosting?.title || "Job";
  if (jobOwnerId && actorId && jobOwnerId !== actorId) {
    if (existingPending) {
      void sendNotification(
        jobOwnerId,
        "Interview Rescheduled",
        `An interview (${type.replace(/_/g, " ")}) for candidate on "${jobTitle}" was rescheduled.`,
        "INFO",
        `/ta/applications/${applicationId}`
      );
    } else {
      void sendNotification(
        jobOwnerId,
        "Interview Scheduled for Candidate",
        `An interview (${type.replace(/_/g, " ")}) has been scheduled for candidate on "${jobTitle}".`,
        "INFO",
        `/ta/applications/${applicationId}`
      );
    }
  }

  return interview;
};

// Records direct interview or client evaluation outcome without forcing prior scheduling
export const recordDirectInterviewResult = async (
  applicationId: number,
  type: any,
  result: string,
  conductedAt?: string | null,
  notes?: string,
  actorId?: string
) => {
  if (!["INITIAL_SCREENING", "FINAL_INTERVIEW"].includes(type)) {
    throw new Error("type must be INITIAL_SCREENING or FINAL_INTERVIEW");
  }
  if (!["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW", "PENDING"].includes(result)) {
    throw new Error("result must be PASS, PASSED, FAIL, FAILED, NO_SHOW, or PENDING");
  }

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      isArchived: true,
      userId: true,
      jobPosting: { select: { postedById: true, title: true } },
    },
  });

  if (!application) throw new Error("Application not found");
  if (application.isArchived) throw new Error("Cannot record interview for archived application");

  // Check if an existing pending interview of this type exists to update
  const existingInterview = await prisma.interview.findFirst({
    where: {
      applicationId,
      type,
      isActive: true,
      result: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingInterview) {
    return await updateInterviewResult(applicationId, existingInterview.id, result, conductedAt || undefined, notes, actorId);
  }

  // Otherwise create a new interview record directly
  const conductedDate = conductedAt ? new Date(conductedAt) : new Date();
  const deadline = new Date(conductedDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  const newInterview = await prisma.interview.create({
    data: {
      applicationId,
      type,
      scheduledAt: conductedDate,
      conductedAt: conductedDate,
      result,
      notes,
      complianceDeadline: deadline,
      isCompliant: true,
      isActive: true,
    },
  });

  let applicationUpdateMessage = "";
  if (result === "NO_SHOW") {
    const { archiveTAApplication } = await import("./ta.applications.service.js");
    try {
      await archiveTAApplication(applicationId, actorId, "Interview NO_SHOW auto-archive");
      applicationUpdateMessage = " Application automatically moved to ARCHIVED due to NO_SHOW.";
    } catch (err: any) {
      applicationUpdateMessage = ` Could not auto-archive application: ${err.message}`;
    }
  } else if (type === "INITIAL_SCREENING" && ["PASS", "PASSED"].includes(result)) {
    const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
    const currentApp = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (currentApp && ["SUBMITTED", "PARSING", "REVIEW", "MATCHED", "NEEDS_ATTENTION", "TALENT_POOL"].includes(currentApp.status)) {
      try {
        await updateTAApplicationStatus(
          applicationId,
          "INITIAL_SCREENING",
          actorId,
          notes || "Passed initial screening interview"
        );
        applicationUpdateMessage = " Application moved to INITIAL_SCREENING stage.";
      } catch (err: any) {
        console.error("[Interviews] Failed to auto-transition application to INITIAL_SCREENING:", err.message);
      }
    }
  }

  const notifType = ["PASS", "PASSED"].includes(result)
    ? "SUCCESS"
    : ["FAIL", "FAILED", "NO_SHOW"].includes(result)
    ? "WARNING"
    : "INFO";

  if (application.userId) {
    void sendNotification(
      application.userId,
      "Interview Update",
      `Your ${type.replace(/_/g, " ")} result has been recorded as ${result}.`,
      notifType,
      `/app/applications/${applicationId}`
    );
  }

  const jobOwnerId = application.jobPosting?.postedById;
  const jobTitle = application.jobPosting?.title || "Requisition";
  if (jobOwnerId && actorId && jobOwnerId !== actorId) {
    void sendNotification(
      jobOwnerId,
      "Interview Result Recorded",
      `${type.replace(/_/g, " ")} result for candidate on "${jobTitle}" recorded as ${result}.`,
      ["PASS", "PASSED"].includes(result) ? "SUCCESS" : "WARNING",
      `/ta/applications/${applicationId}`
    );
  }

  void logAudit(actorId || null, "INTERVIEW_RESULT_RECORDED", "Application", applicationId, {
    interviewId: newInterview.id,
    type,
    result,
    notes,
    recordedDirectly: true,
    decisionMadeBy: type === "FINAL_INTERVIEW" ? "CLIENT" : "TA",
  });

  return { updatedInterview: newInterview, applicationUpdateMessage };
};

// Records interview outcome; NO_SHOW automatically archives the application
export const updateInterviewResult = async (
  applicationId: number,
  interviewId: number,
  result: string,
  conductedAt?: string,
  notes?: string,
  actorId?: string
) => {
  if (!["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW", "PENDING"].includes(result)) {
    throw new Error("result must be PASS, PASSED, FAIL, FAILED, NO_SHOW, or PENDING");
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId, applicationId },
    include: {
      application: {
        select: {
          userId: true,
          status: true,
          jobPosting: { select: { postedById: true, title: true } },
        },
      },
    },
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
    const { archiveTAApplication } = await import("./ta.applications.service.js");
    try {
      await archiveTAApplication(applicationId, actorId, "Interview NO_SHOW auto-archive");
      applicationUpdateMessage = " Application automatically moved to ARCHIVED due to NO_SHOW.";
    } catch (err: any) {
      applicationUpdateMessage = ` Could not auto-archive application: ${err.message}`;
    }
  } else if (interview.type === "INITIAL_SCREENING" && ["PASS", "PASSED"].includes(result)) {
    const { updateTAApplicationStatus } = await import("./ta.applications.service.js");
    const currentApp = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { status: true },
    });
    if (currentApp && ["SUBMITTED", "PARSING", "REVIEW", "MATCHED", "NEEDS_ATTENTION", "TALENT_POOL"].includes(currentApp.status)) {
      try {
        await updateTAApplicationStatus(
          applicationId,
          "INITIAL_SCREENING",
          actorId,
          notes || "Passed initial screening interview"
        );
        applicationUpdateMessage = " Application moved to INITIAL_SCREENING stage.";
      } catch (err: any) {
        console.error("[Interviews] Failed to auto-transition application to INITIAL_SCREENING:", err.message);
      }
    }
  }

  const notifType = ["PASS", "PASSED"].includes(result)
    ? "SUCCESS"
    : ["FAIL", "FAILED", "NO_SHOW"].includes(result)
    ? "WARNING"
    : "INFO";

  if (interview.application?.userId) {
    void sendNotification(
      interview.application.userId,
      "Interview Update",
      `Your ${interview.type.replace(/_/g, " ")} result has been recorded as ${result}.`,
      notifType,
      `/app/applications/${applicationId}`
    );
  }

  const jobOwnerId = interview.application?.jobPosting?.postedById;
  const jobTitle = interview.application?.jobPosting?.title || "Requisition";
  if (jobOwnerId && actorId && jobOwnerId !== actorId) {
    void sendNotification(
      jobOwnerId,
      "Interview Result Recorded",
      `${interview.type.replace(/_/g, " ")} result for candidate on "${jobTitle}" recorded as ${result}.`,
      ["PASS", "PASSED"].includes(result) ? "SUCCESS" : "WARNING",
      `/ta/applications/${applicationId}`
    );
  }

  void logAudit(actorId || null, "INTERVIEW_RESULT_RECORDED", "Application", applicationId, {
    interviewId,
    type: interview.type,
    result,
    notes,
    decisionMadeBy: interview.type === "FINAL_INTERVIEW" ? "CLIENT" : "TA",
  });

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

    const candidateName = `${app.user.applicantProfile?.firstName || ""} ${app.user.applicantProfile?.lastName || ""}`.trim() || "Candidate";
    const deadlineDate = new Date(app.updatedAt.getTime() + 7 * ONE_DAY_MS);

    return {
      interviewId: app.id,
      applicationId: app.id,
      candidate: candidateName,
      candidateName,
      job: app.jobPosting.title,
      jobTitle: app.jobPosting.title,
      currentStage: app.status,
      enteredStageAt: app.updatedAt,
      scheduledAt: app.updatedAt.toISOString(),
      deadline: deadlineDate.toISOString(),
      daysInStage,
      status: slaStatus as "HEALTHY" | "WARNING" | "BREACHED",
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
