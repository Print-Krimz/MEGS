import prisma from "../../utils/prisma.js";
import { sendNotification, type NotificationResult } from "../../utils/notification.js";
import { formatManilaDateTime } from "../../schemas/field-limits.js";
import { safeLogError } from "../../security/errors.js";
import { appointmentReminderKey, type ScheduleActivityName } from "../../services/scheduling/reschedule.service.js";
import { DAY_MS, newResult, type ReminderResult } from "./rules.js";

const CLOSED_STATUSES = ["REJECTED", "BACKOUT", "ARCHIVED"] as const;

const bump = (result: ReminderResult, outcome: NotificationResult) => {
  if (outcome === "sent") result.sentCount++;
  else if (outcome === "duplicate") result.duplicateCount++;
  else if (outcome === "failed") result.failedCount++;
};

const remind = async (
  result: ReminderResult,
  userId: string,
  applicationId: number,
  activity: ScheduleActivityName,
  recordId: number,
  scheduledAt: Date,
  location: string | null
) => {
  const isContract = activity === "CONTRACT_SIGNING";
  const label = activity === "INITIAL_SCREENING" ? "Initial Screening" : activity === "FINAL_INTERVIEW" ? "Final Interview" : "contract signing";
  try {
    bump(
      result,
      await sendNotification(
        userId,
        isContract ? "Contract Signing Reminder" : "Interview Reminder",
        `Your ${label} is coming up on ${formatManilaDateTime(scheduledAt)}.${location ? ` Location: ${location}.` : ""}`,
        "INFO",
        `/app/applications/${applicationId}`,
        {
          sendEmail: true,
          ctaText: "View Details",
          dedupeKey: appointmentReminderKey(activity, recordId, scheduledAt),
          sms: {
            always: true,
            text: `Reminder: your ${label} is on ${formatManilaDateTime(scheduledAt)}.${location ? ` Location: ${location}.` : ""} Log in to MEGS for details.`,
          },
        }
      )
    );
  } catch (error) {
    result.failedCount++;
    safeLogError(`appointment reminder for application ${applicationId}`, error);
  }
};

/** Applicant: an interview or contract signing starts within the next 24 hours. A reschedule changes the key, so it reminds again. */
export const sendAppointmentReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const horizon = new Date(now.getTime() + DAY_MS);
  const result = newResult();

  const interviews = await prisma.interview.findMany({
    where: {
      isActive: true,
      type: { in: ["INITIAL_SCREENING", "FINAL_INTERVIEW"] },
      result: { in: ["PENDING", "SCHEDULED"] },
      scheduledAt: { gt: now, lte: horizon },
      application: { isArchived: false, status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: { id: true, type: true, scheduledAt: true, location: true, application: { select: { id: true, userId: true } } },
  });

  const signings = await prisma.application.findMany({
    where: {
      isArchived: false,
      status: "CONTRACT_SIGNING",
      contractSigned: false,
      contractSigningAt: { gt: now, lte: horizon },
    },
    select: { id: true, userId: true, contractSigningAt: true, contractSigningLocation: true },
  });

  result.scannedCount = interviews.length + signings.length;

  for (const row of interviews) {
    if (!row.application || !row.scheduledAt) continue;
    await remind(result, row.application.userId, row.application.id, row.type as ScheduleActivityName, row.id, row.scheduledAt, row.location);
  }
  for (const row of signings) {
    if (!row.contractSigningAt) continue;
    await remind(result, row.userId, row.id, "CONTRACT_SIGNING", row.id, row.contractSigningAt, row.contractSigningLocation);
  }
  return result;
};
