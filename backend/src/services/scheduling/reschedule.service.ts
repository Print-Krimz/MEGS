import prisma from "../../utils/prisma.js";
import { notifyJobOwner, sendNotification } from "../../utils/notification.js";
import { logAudit } from "../../utils/audit.js";
import { formatManilaDateTime } from "../../schemas/field-limits.js";
import { JOB_OWNER_SELECT } from "../ta/ownership.js";

// Reschedule requests for the three scheduled activities: Initial Screening, Final Interview and Contract Signing.

export type ScheduleActivityName = "INITIAL_SCREENING" | "FINAL_INTERVIEW" | "CONTRACT_SIGNING";

export const ACTIVITY_LABEL: Record<ScheduleActivityName, string> = {
  INITIAL_SCREENING: "Initial Screening",
  FINAL_INTERVIEW: "Final Interview",
  CONTRACT_SIGNING: "Contract Signing",
};

export const PENDING_REQUEST_MESSAGE = "Your request is already with your recruiter.";
export const ALREADY_RESCHEDULED_MESSAGE = "You've already rescheduled this once. Contact your recruiter for changes.";
export const ONCE_PER_STAGE_MESSAGE = "You can request a new schedule once per stage. Contact your recruiter for changes.";
export const WALK_IN_RESCHEDULE_MESSAGE = "Walk-in applicants reschedule by phone. Contact your recruiter to change your schedule.";

/** An error that carries the HTTP status the controller should answer with. */
export class SchedulingError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = "SchedulingError";
  }
}

const CLOSED_STATUSES = ["REJECTED", "BACKOUT", "ARCHIVED", "DEPLOYED"];

/** Notification dedupe key for an appointment reminder. A new time gives a new key, so a reschedule re-arms it. */
export const appointmentReminderKey = (activity: ScheduleActivityName, recordId: number | string, scheduledAt: Date): string =>
  `appt:${activity}:${recordId}:${scheduledAt.toISOString()}`;

export const REQUEST_SELECT = {
  id: true,
  activity: true,
  interviewId: true,
  status: true,
  reason: true,
  previousScheduledAt: true,
  newScheduledAt: true,
  decisionNote: true,
  createdAt: true,
  decidedAt: true,
} as const;

const isUniqueViolation = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

// ─────────────────────────────────────────────
// Applicant
// ─────────────────────────────────────────────

export const createRescheduleRequest = async (
  applicationId: number,
  userId: string,
  activity: ScheduleActivityName,
  reason: string
) => {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    select: {
      id: true,
      status: true,
      isArchived: true,
      source: true,
      contractSigningAt: true,
      contractSigningLocation: true,
      user: { select: { applicantProfile: { select: { firstName: true, lastName: true } } } },
      jobPosting: { select: { id: true, title: true, ...JOB_OWNER_SELECT } },
    },
  });
  if (!application) throw new SchedulingError("Application not found", 404);
  if (application.isArchived || CLOSED_STATUSES.includes(application.status)) {
    throw new SchedulingError("This application is closed, so it can't be rescheduled.");
  }

  if (application.source === "WALK_IN") throw new SchedulingError(WALK_IN_RESCHEDULE_MESSAGE, 403);

  const now = new Date();
  let interviewId: number | null = null;
  let current: Date;
  let place: string | null = null;
  if (activity === "CONTRACT_SIGNING") {
    if (application.status !== "CONTRACT_SIGNING" || !application.contractSigningAt || application.contractSigningAt <= now) {
      throw new SchedulingError("There's no upcoming contract signing to reschedule.");
    }
    current = application.contractSigningAt;
    place = application.contractSigningLocation ?? null;
  } else {
    const interview = await prisma.interview.findFirst({
      where: {
        applicationId,
        type: activity,
        isActive: true,
        result: { in: ["PENDING", "SCHEDULED"] },
        scheduledAt: { gt: now },
      },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, scheduledAt: true, location: true },
    });
    if (!interview?.scheduledAt) throw new SchedulingError(`There's no upcoming ${ACTIVITY_LABEL[activity]} to reschedule.`);
    interviewId = interview.id;
    current = interview.scheduledAt;
    place = interview.location ?? null;
  }

  const pending = await prisma.rescheduleRequest.findFirst({
    where: { applicationId, activity, status: "PENDING" },
    select: { id: true },
  });
  if (pending) throw new SchedulingError(PENDING_REQUEST_MESSAGE, 409);
  if (activity === "CONTRACT_SIGNING") {
    // Contract signing: one approved move per application.
    const approved = await prisma.rescheduleRequest.findFirst({
      where: { applicationId, activity, status: "APPROVED" },
      select: { id: true },
    });
    if (approved) throw new SchedulingError(ALREADY_RESCHEDULED_MESSAGE, 409);
  } else {
    // Interviews: one request per stage, whatever the outcome (waiting, approved or rejected).
    const any = await prisma.rescheduleRequest.findFirst({
      where: { applicationId, activity },
      select: { id: true },
    });
    if (any) throw new SchedulingError(ONCE_PER_STAGE_MESSAGE, 409);
  }

  let request;
  try {
    request = await prisma.rescheduleRequest.create({
      data: { applicationId, activity, interviewId, reason, previousScheduledAt: current, requestedById: userId },
      select: REQUEST_SELECT,
    });
  } catch (error) {
    // Two taps at once: the database allows one pending request per application and activity.
    if (isUniqueViolation(error)) throw new SchedulingError(PENDING_REQUEST_MESSAGE, 409);
    throw error;
  }

  const profile = application.user?.applicantProfile;
  const name = `${profile?.firstName ?? ""} ${profile?.lastName ?? ""}`.trim() || "The applicant";
  void notifyJobOwner(
    application.jobPosting,
    "Reschedule Requested",
    `${name} asked to move the ${ACTIVITY_LABEL[activity]} for "${application.jobPosting?.title ?? "the job"}" ` +
      `from ${formatManilaDateTime(current)}${place ? ` (${place})` : ""}. Reason: ${reason}`,
    "INFO",
    `/ta/applications/${applicationId}`,
    { sendEmail: true, ctaText: "Review Request" }
  );

  void logAudit(userId, "RESCHEDULE_REQUESTED", "Application", applicationId, {
    requestId: request.id,
    activity,
    interviewId,
    previousScheduledAt: current,
    reason,
  });

  return request;
};

// ─────────────────────────────────────────────
// TA
// ─────────────────────────────────────────────

/**
 * Marks the open request for this activity as answered by a reschedule. Used when the TA moves the
 * appointment directly (the request is then approved) and by approveRescheduleRequest itself.
 * Never throws: the reschedule it follows has already been saved.
 */
export const resolvePendingRescheduleRequest = async (
  applicationId: number,
  activity: ScheduleActivityName,
  newScheduledAt: string | Date,
  actorId?: string | null
) => {
  try {
    const pending = await prisma.rescheduleRequest.findFirst({
      where: { applicationId, activity, status: "PENDING" },
      select: { id: true },
    });
    if (!pending) return null;
    const { count } = await prisma.rescheduleRequest.updateMany({
      where: { id: pending.id, status: "PENDING" },
      data: { status: "APPROVED", decidedById: actorId ?? null, decidedAt: new Date(), newScheduledAt: new Date(newScheduledAt) },
    });
    if (count > 0) {
      void logAudit(actorId ?? null, "RESCHEDULE_APPROVED", "Application", applicationId, {
        requestId: pending.id,
        activity,
        newScheduledAt,
      });
    }
    return pending.id;
  } catch (error) {
    console.error("[Reschedule] Could not close the pending request:", (error as Error).message);
    return null;
  }
};

const loadOpenRequest = async (applicationId: number, requestId: number) => {
  const request = await prisma.rescheduleRequest.findFirst({ where: { id: requestId, applicationId } });
  if (!request) throw new SchedulingError("Reschedule request not found", 404);
  if (request.status !== "PENDING") throw new SchedulingError("This request was already answered.", 409);
  return request;
};

export const approveRescheduleRequest = async (
  applicationId: number,
  requestId: number,
  actorId: string,
  body: { scheduledAt: string; location?: string }
) => {
  const request = await loadOpenRequest(applicationId, requestId);
  const activity = request.activity as ScheduleActivityName;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { userId: true },
  });
  if (!application) throw new SchedulingError("Application not found", 404);

  if (activity !== "CONTRACT_SIGNING") {
    // Only an interview that is still waiting can be moved; a new row would not be a reschedule.
    const open = request.interviewId
      ? await prisma.interview.findFirst({
          where: { id: request.interviewId, applicationId, isActive: true, result: { in: ["PENDING", "SCHEDULED"] } },
          select: { id: true },
        })
      : null;
    if (!open) throw new SchedulingError("This interview is no longer scheduled, so it can't be moved.", 409);
  }

  // Claim the request first so two approvals cannot both schedule. The scheduler then finds nothing pending to close.
  const claim = await prisma.rescheduleRequest.updateMany({
    where: { id: requestId, applicationId, status: "PENDING" },
    data: { status: "APPROVED", decidedById: actorId, decidedAt: new Date() },
  });
  if (claim.count === 0) throw new SchedulingError("This request was already answered.", 409);

  try {
    if (activity === "CONTRACT_SIGNING") {
      const { scheduleContractSigning } = await import("../ta/ta.applications.service.js");
      await scheduleContractSigning(applicationId, body.scheduledAt, body.location, actorId, { skipApplicantNotice: true });
    } else {
      const { scheduleNewInterview } = await import("../ta/ta.interviews.service.js");
      await scheduleNewInterview(applicationId, activity, body.scheduledAt, body.location, actorId, { skipApplicantNotice: true });
    }
  } catch (error) {
    await prisma.rescheduleRequest
      .updateMany({
        where: { id: requestId, status: "APPROVED" },
        data: { status: "PENDING", decidedById: null, decidedAt: null },
      })
      .catch(() => undefined);
    throw error;
  }

  await prisma.rescheduleRequest.updateMany({
    where: { id: requestId },
    data: { newScheduledAt: new Date(body.scheduledAt) },
  });
  void logAudit(actorId, "RESCHEDULE_APPROVED", "Application", applicationId, {
    requestId,
    activity,
    newScheduledAt: body.scheduledAt,
  });

  void sendNotification(
    application.userId,
    "Reschedule Approved",
    `Your ${ACTIVITY_LABEL[activity]} was moved to ${formatManilaDateTime(new Date(body.scheduledAt))}.` +
      (body.location ? ` Location: ${body.location}.` : ""),
    "SUCCESS",
    `/app/applications/${applicationId}`,
    {
      sendEmail: true,
      ctaText: "View Details",
      dedupeKey: `reschedule-approved:${requestId}:${application.userId}`,
      sms: {
        always: true,
        text: `Your ${ACTIVITY_LABEL[activity]} was moved to ${formatManilaDateTime(new Date(body.scheduledAt))}.${body.location ? ` Location: ${body.location}.` : ""} Log in to MEGS for details.`,
      },
    }
  );

  return prisma.rescheduleRequest.findUnique({ where: { id: requestId } });
};

export const rejectRescheduleRequest = async (
  applicationId: number,
  requestId: number,
  actorId: string,
  decisionNote?: string
) => {
  const request = await loadOpenRequest(applicationId, requestId);
  const note = decisionNote?.trim() || null;

  const { count } = await prisma.rescheduleRequest.updateMany({
    where: { id: requestId, applicationId, status: "PENDING" },
    data: { status: "REJECTED", decidedById: actorId, decidedAt: new Date(), decisionNote: note },
  });
  if (count === 0) throw new SchedulingError("This request was already answered.", 409);

  const application = await prisma.application.findUnique({ where: { id: applicationId }, select: { userId: true } });
  if (application) {
    void sendNotification(
      application.userId,
      "Reschedule Declined",
      `Your request to move the ${ACTIVITY_LABEL[request.activity as ScheduleActivityName]} was declined.` +
        (note ? ` Note: ${note}` : "") +
        ` Your current schedule still stands: ${formatManilaDateTime(request.previousScheduledAt)}.`,
      "WARNING",
      `/app/applications/${applicationId}`,
      {
        dedupeKey: `reschedule-declined:${request.id}:${application.userId}`,
        sendEmail: true,
        ctaText: "View Details",
        sms: {
          text: `Your request to move the ${ACTIVITY_LABEL[request.activity as ScheduleActivityName]} was declined. Your schedule still stands: ${formatManilaDateTime(request.previousScheduledAt)}.`,
        },
      }
    );
  }

  void logAudit(actorId, "RESCHEDULE_REJECTED", "Application", applicationId, {
    requestId,
    activity: request.activity,
    decisionNote: note,
  });

  return prisma.rescheduleRequest.findUnique({ where: { id: requestId } });
};
