import prisma from '../../utils/prisma.js';
import { sendNotification } from '../../utils/notification.js';
import { logAudit } from '../../utils/audit.js';
import { recordBackout } from './backout.service.js';
import { isFutureDateTime, isWorkingHours } from "../../schemas/field-limits.js";
import { ownedWhere, type Actor } from "./ownership.js";
import { isPageRequested, paginateArray, type PageRequest } from "../../utils/pagination.js";

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
    throw new Error("Choose either Initial Screening or Final Interview.");
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new Error("Enter a valid interview date and time.");
  }
  if (scheduledDate.getUTCFullYear() < 1900 || scheduledDate.getUTCFullYear() > 2100) {
    throw new Error("Interview dates must be within 1900 through 2100.");
  }
  if (!isFutureDateTime(scheduledAt)) {
    throw new Error("Cannot schedule an interview in the past. Please select a future date and time.");
  }
  if (!isWorkingHours(scheduledAt)) {
    throw new Error("Interviews must be scheduled during strictly working hours (9:00 AM to 5:00 PM Manila time).");
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

  const invalidStages = ["COMPLIANCE", "DEPLOYED", "ARCHIVED", "BACKOUT", "REJECTED"];
  if (invalidStages.includes(application.status)) {
    throw new Error("An interview can't be scheduled at this application's current stage.");
  }

  if (type === "INITIAL_SCREENING") {
    // TALENT_POOL is excluded: a pooled application can only be archived (see pipeline-rules.ts); invite the
    // candidate to a new application instead.
    const screeningStages = ["SUBMITTED", "PARSING", "REVIEW", "MATCHED", "INITIAL_SCREENING", "NEEDS_ATTENTION"];
    if (!screeningStages.includes(application.status)) {
      throw new Error("An Initial Screening interview can't be scheduled at this application's current stage.");
    }

    const passedScreening = await prisma.interview.findFirst({
      where: { applicationId, type: "INITIAL_SCREENING", result: { in: ["PASS", "PASSED"] }, isActive: true },
      select: { id: true, result: true },
    });
    if (passedScreening && ["PASS", "PASSED"].includes(String(passedScreening.result))) {
      throw new Error("The candidate already passed the Initial interview. Another Initial interview cannot be scheduled.");
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
    // FINAL_INTERVIEW requires that the candidate passed Initial Screening
    const screening = await prisma.interview.findFirst({
      where: {
        applicationId,
        type: "INITIAL_SCREENING",
        result: { in: ["PASS", "PASSED"] },
        isActive: true,
      },
    });
    if (!screening) {
      throw new Error("Cannot schedule a Final Interview. The candidate must first complete and pass Initial Screening.");
    }

    const declinedEndorsement = await prisma.clientEndorsement.findFirst({
      where: {
        applicationId,
        outcome: { in: ["DECLINED", "REJECTED"] },
      },
    });
    if (declinedEndorsement) {
      throw new Error("Cannot schedule a Final Interview. The client endorsement was declined.");
    }

    const passedFinal = await prisma.interview.findFirst({
      where: { applicationId, type: "FINAL_INTERVIEW", result: { in: ["PASS", "PASSED"] }, isActive: true },
      select: { id: true, result: true },
    });
    if (passedFinal && ["PASS", "PASSED"].includes(String(passedFinal.result))) {
      throw new Error("The candidate already passed the Final interview. Another Final interview cannot be scheduled.");
    }

    const finalStages = ["INITIAL_SCREENING", "CLIENT_ENDORSEMENT", "FINAL_INTERVIEW"];
    if (!finalStages.includes(application.status)) {
      throw new Error("A Final Interview can't be scheduled at this application's current stage.");
    }

    // Advance application status to FINAL_INTERVIEW if not already in FINAL_INTERVIEW
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
      `/app/applications/${applicationId}`,
      {
        sendEmail: true,
        ctaText: "View Interview Details",
      }
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
      `/app/applications/${applicationId}`,
      {
        sendEmail: true,
        ctaText: "View Interview Details",
      }
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

export const FINAL_INTERVIEW_RESULTS = ["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW"] as const;

/** A result is final once anything other than PENDING/empty has been recorded. */
export const isInterviewResultFinal = (result?: string | null): boolean =>
  !!result && (FINAL_INTERVIEW_RESULTS as readonly string[]).includes(result);

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
    throw new Error("Choose either Initial Screening or Final Interview.");
  }
  if (!["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW", "PENDING"].includes(result)) {
    throw new Error("Choose a result: Pass, Fail, No Show, or Pending.");
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

  // Recording directly must not sidestep a finalized result of the same interview type.
  const finalized = await prisma.interview.findFirst({
    where: { applicationId, type, isActive: true, result: { in: [...FINAL_INTERVIEW_RESULTS] } },
    select: { id: true, result: true },
  });
  if (finalized) {
    throw new Error(
      `Interview result is finalized (${finalized.result}) and can no longer be edited. Contact an administrator to request a correction, or schedule a new interview round.`
    );
  }

  // Otherwise create a new interview record directly
  const conductedDate = conductedAt ? new Date(conductedAt) : new Date();
  if (!Number.isFinite(conductedDate.getTime()) || conductedDate.getTime() > Date.now()) {
    throw new Error("Recorded interview time cannot be in the future.");
  }
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
    if (application.userId) {
      const profile = await prisma.applicantProfile.findUnique({
        where: { userId: application.userId },
        select: { id: true },
      });
      if (profile) {
        await prisma.applicantProfile.update({
          where: { id: profile.id },
          data: { hasNoShowHistory: true },
        });
        await prisma.talentPoolMembership.upsert({
          where: { applicantProfileId: profile.id },
          create: {
            applicantProfileId: profile.id,
            sourceApplicationId: applicationId,
            status: "ARCHIVED",
            availability: "UNAVAILABLE",
            addedById: actorId || application.userId,
            notes: "Applicant marked as NO_SHOW on interview",
          },
          update: {
            status: "ARCHIVED",
            availability: "UNAVAILABLE",
            notes: "Applicant marked as NO_SHOW on interview",
          },
        });
      }
    }

    try {
      await recordBackout({
        applicationId,
        party: "APPLICANT",
        reason: "NO_SHOW",
        notes: "Missed scheduled interview",
        disposition: "ARCHIVE",
        actorId: actorId || application.userId,
        actorRole: "TALENT_ACQUISITION",
      });
      applicationUpdateMessage = " Recorded as an applicant backout (no-show).";
    } catch (err: any) {
      applicationUpdateMessage = ` Could not record the backout: ${err.message}`;
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
      `/app/applications/${applicationId}`,
      {
        sendEmail: true,
        ctaText: "Check Application Status",
      }
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
    throw new Error("Choose a result: Pass, Fail, No Show, or Pending.");
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

  if (isInterviewResultFinal(interview.result)) {
    throw new Error(
      "Interview result is finalized and can no longer be edited. Contact an administrator to request a correction."
    );
  }

  if (conductedAt) {
    const conductedDate = new Date(conductedAt);
    if (!Number.isFinite(conductedDate.getTime()) || conductedDate.getTime() > Date.now()) {
      throw new Error("Recorded interview time cannot be in the future.");
    }
  }

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
    if (interview.application?.userId) {
      const profile = await prisma.applicantProfile.findUnique({
        where: { userId: interview.application.userId },
        select: { id: true },
      });
      if (profile) {
        await prisma.applicantProfile.update({
          where: { id: profile.id },
          data: { hasNoShowHistory: true },
        });
        await prisma.talentPoolMembership.upsert({
          where: { applicantProfileId: profile.id },
          create: {
            applicantProfileId: profile.id,
            sourceApplicationId: applicationId,
            status: "ARCHIVED",
            availability: "UNAVAILABLE",
            addedById: actorId || interview.application.userId,
            notes: "Applicant marked as NO_SHOW on interview",
          },
          update: {
            status: "ARCHIVED",
            availability: "UNAVAILABLE",
            notes: "Applicant marked as NO_SHOW on interview",
          },
        });
      }
    }

    try {
      await recordBackout({
        applicationId,
        party: "APPLICANT",
        reason: "NO_SHOW",
        notes: "Missed scheduled interview",
        disposition: "ARCHIVE",
        actorId: actorId || interview.application.userId,
        actorRole: "TALENT_ACQUISITION",
      });
      applicationUpdateMessage = " Recorded as an applicant backout (no-show).";
    } catch (err: any) {
      applicationUpdateMessage = ` Could not record the backout: ${err.message}`;
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
      `/app/applications/${applicationId}`,
      {
        sendEmail: true,
        ctaText: "Check Application Status",
      }
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
export interface InterviewComplianceOptions extends PageRequest {
  search?: string;
  status?: "HEALTHY" | "WARNING" | "BREACHED";
  stage?: "INITIAL_SCREENING" | "FINAL_INTERVIEW";
  position?: string;
  sortField?: "candidate" | "position" | "scheduledAt" | "deadline";
  sortDirection?: "asc" | "desc";
}

export const getInterviewComplianceReport = async (actor?: Actor, options: InterviewComplianceOptions = {}) => {
  const applications = await prisma.application.findMany({
    where: {
      status: { in: ["INITIAL_SCREENING", "FINAL_INTERVIEW"] },
      isArchived: false,
      ...(actor ? ownedWhere.application(actor) : {}),
    },
    select: {
      id: true,
      status: true,
      updatedAt: true,
      jobPosting: { select: { title: true } },
      user: { select: { applicantProfile: { select: { firstName: true, lastName: true } } } },
      // The open interview for the current stage. A row only records an outcome against a real interview.
      interviews: {
        where: {
          isActive: true,
          OR: [{ result: null }, { result: { in: ["PENDING", "SCHEDULED"] } }],
        },
        select: { id: true, type: true, scheduledAt: true },
        orderBy: { scheduledAt: "desc" },
      },
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
    const openInterview = app.interviews.find((interview) => interview.type === app.status) ?? null;

    return {
      // Null when the stage has no open interview yet: the recruiter schedules one instead of recording an outcome.
      interviewId: openInterview?.id ?? null,
      applicationId: app.id,
      candidate: candidateName,
      candidateName,
      job: app.jobPosting.title,
      jobTitle: app.jobPosting.title,
      currentStage: app.status,
      enteredStageAt: app.updatedAt,
      scheduledAt: (openInterview?.scheduledAt ?? app.updatedAt).toISOString(),
      deadline: deadlineDate.toISOString(),
      daysInStage,
      status: slaStatus as "HEALTHY" | "WARNING" | "BREACHED",
      slaStatus,
      daysUntilBreach: Math.max(0, 7 - daysInStage)
    };
  });

  const summary = {
    total: complianceReport.length,
    breached: complianceReport.filter(r => r.slaStatus === "BREACHED").length,
    warning: complianceReport.filter(r => r.slaStatus === "WARNING").length,
    healthy: complianceReport.filter(r => r.slaStatus === "HEALTHY").length,
  };

  if (!isPageRequested(options)) return { summary, details: complianceReport };

  // Paginated: filter and sort the whole report, then return one page. The summary and the
  // position list always cover the unfiltered report so counts and filter choices stay stable.
  const query = options.search?.trim().toLowerCase();
  const direction = options.sortDirection === "desc" ? -1 : 1;
  const sortField = options.sortField ?? "deadline";
  const matches = complianceReport
    .filter((row) =>
      (!options.status || row.slaStatus === options.status) &&
      (!options.stage || row.currentStage === options.stage) &&
      (!options.position || row.jobTitle === options.position) &&
      (!query || row.candidateName.toLowerCase().includes(query) || row.jobTitle.toLowerCase().includes(query))
    )
    .sort((a, b) => {
      const comparison =
        sortField === "candidate" ? a.candidateName.localeCompare(b.candidateName)
        : sortField === "position" ? a.jobTitle.localeCompare(b.jobTitle)
        : sortField === "scheduledAt" ? new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        : new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      return comparison * direction || a.applicationId - b.applicationId;
    });
  const positions = [...new Set(complianceReport.map((row) => row.jobTitle).filter((title) => title.trim()))].sort((a, b) => a.localeCompare(b));
  return { ...paginateArray(matches, options), summary, positions };
};

// Aliases for consistency with plan & controller terminology
export const scheduleInterview = scheduleNewInterview;
export const completeInterview = updateInterviewResult;



/**
 * Admin-only correction of a finalized interview result.
 * The original result is preserved in the (immutable) audit log along with every later correction.
 */
export const correctInterviewResult = async (
  interviewId: number,
  newResult: string,
  reason: string,
  adminId: string,
  notes?: string
) => {
  if (!["PASS", "PASSED", "FAIL", "FAILED", "NO_SHOW"].includes(newResult)) {
    throw new Error("Choose a result: Pass, Fail, or No Show.");
  }
  if (!reason || reason.trim().length < 10) {
    throw new Error("A reason of at least 10 characters is required to correct an interview result.");
  }

  const interview = await prisma.interview.findUnique({
    where: { id: interviewId },
    include: { application: { select: { id: true, status: true } } },
  });
  if (!interview) throw new Error("Interview not found");
  if (!isInterviewResultFinal(interview.result)) {
    throw new Error("Only finalized interview results can be corrected. Use the normal result update instead.");
  }
  if (interview.result === newResult) {
    throw new Error("The new result is the same as the current result.");
  }

  const updatedInterview = await prisma.interview.update({
    where: { id: interviewId },
    data: { result: newResult, ...(notes !== undefined ? { notes } : {}) },
  });

  await logAudit(adminId, "INTERVIEW_RESULT_CORRECTED", "Interview", interviewId, {
    applicationId: interview.applicationId,
    type: interview.type,
    previousResult: interview.result,
    newResult,
    reason: reason.trim(),
    applicationStatus: interview.application?.status,
  });

  const stageWarning =
    interview.application &&
    ((interview.type === "FINAL_INTERVIEW" && ["COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"].includes(interview.application.status)) ||
      (interview.type === "INITIAL_SCREENING" && ["CLIENT_ENDORSEMENT", "FINAL_INTERVIEW", "COMPLIANCE", "CONTRACT_SIGNING", "DEPLOYED"].includes(interview.application.status)))
      ? `The application is already in ${interview.application.status}; its stage was not changed automatically. Review it manually.`
      : null;

  return { updatedInterview, previousResult: interview.result, stageWarning };
};
