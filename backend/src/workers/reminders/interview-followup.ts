import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { JOB_OWNER_SELECT, jobOwnerTaId } from "../../services/ta/ownership.js";
import { safeLogError } from "../../security/errors.js";
import {
  addTally,
  daysUntilDue,
  dueMilestone,
  dueSince, dueWithin,
  formatDue,
  isOverdue,
  newResult,
  reminderKey,
  type MilestoneRule,
  type ReminderResult,
} from "./rules.js";

const CLOSED_STATUSES = ["REJECTED", "BACKOUT", "ARCHIVED"] as const;
const RULE: MilestoneRule = { soonDays: 1, overdueEvery: 3 };

/** Owner TA: 1 day before the 7-day interview follow-up window ends, when it is overdue, then every 3 days. */
export const sendInterviewFollowupReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.interview.findMany({
    where: {
      isActive: true,
      result: "PENDING",
      complianceDeadline: { not: null, gte: dueSince(now), lte: dueWithin(now, 1) },
      application: { isArchived: false, status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: {
      id: true,
      complianceDeadline: true,
      application: { select: { id: true, jobPosting: { select: JOB_OWNER_SELECT } } },
    },
  });

  const result = newResult();
  result.scannedCount = rows.length;

  for (const row of rows) {
    if (!row.complianceDeadline || !row.application) continue;
    try {
      const milestone = dueMilestone(daysUntilDue(row.complianceDeadline, now), RULE);
      if (!milestone) continue;
      const dueText = formatDue(row.complianceDeadline);
      addTally(
        result,
        await notifyOwner(
          row.application.jobPosting ? jobOwnerTaId(row.application.jobPosting) : null,
          "Interview result needed",
          isOverdue(milestone)
            ? `The interview result for application #${row.application.id} was due on ${dueText}. Please record it.`
            : `The interview result for application #${row.application.id} is due on ${dueText}. Please record it.`,
          "WARNING",
          `/ta/applications/${row.application.id}`,
          { dedupeKey: reminderKey("interview-followup", row.id, row.complianceDeadline, milestone), sendEmail: false }
        )
      );
    } catch (error) {
      result.failedCount++;
      safeLogError(`interview-followup reminder for interview ${row.id}`, error);
    }
  }
  return result;
};
