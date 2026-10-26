import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
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

const RULE: MilestoneRule = { soonDays: 7, overdueEvery: 7 };

/**
 * Open requisitions: 7 days before the target fill date, when it passes, then weekly.
 * Admins (team leader) and the assigned TA are both told.
 */
export const sendMrfTargetReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.manpowerRequest.findMany({
    where: { status: "OPEN", targetFillDate: { not: null, gte: dueSince(now), lte: dueWithin(now, 7) } },
    select: { id: true, title: true, targetFillDate: true, assignedTaId: true },
  });

  const result = newResult();
  result.scannedCount = rows.length;

  for (const row of rows) {
    if (!row.targetFillDate) continue;
    try {
      const milestone = dueMilestone(daysUntilDue(row.targetFillDate, now), RULE);
      if (!milestone) continue;
      const dueText = formatDue(row.targetFillDate);
      const overdue = isOverdue(milestone);
      const title = overdue ? "Request past target date" : "Request target date near";
      const message = overdue
        ? `${row.title} should have been filled by ${dueText} and is still open.`
        : `${row.title} should be filled by ${dueText}.`;
      const dedupeKey = reminderKey("mrf-target", row.id, row.targetFillDate, milestone);

      addTally(result, await notifyOwner(null, title, message, "WARNING", `/admin/mrfs/${row.id}`, { dedupeKey, sendEmail: false }));
      if (row.assignedTaId) {
        addTally(result, await notifyOwner(row.assignedTaId, title, message, "WARNING", `/ta/mrfs/${row.id}`, { dedupeKey, sendEmail: false }));
      }
    } catch (error) {
      result.failedCount++;
      safeLogError(`mrf-target reminder for request ${row.id}`, error);
    }
  }
  return result;
};
