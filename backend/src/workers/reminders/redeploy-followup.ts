import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { safeLogError } from "../../security/errors.js";
import { addTally, daysUntilDue, dueMilestone, dueSince, dueWithin, newResult, reminderKey, type MilestoneRule, type ReminderResult } from "./rules.js";

const RULE: MilestoneRule = { today: true, overdueEvery: 7 };

/** Redeployment owner (Admins when unassigned): on the follow-up day, then every 7 days while the worker is still available. */
export const sendRedeployFollowupReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.employee.findMany({
    where: {
      status: "AVAILABLE_FOR_REDEPLOYMENT",
      redeploymentFollowUpAt: { not: null, gte: dueSince(now), lte: dueWithin(now, 0) },
    },
    select: { id: true, redeploymentFollowUpAt: true, redeploymentOwnerId: true },
  });

  const result = newResult();
  result.scannedCount = rows.length;

  for (const row of rows) {
    if (!row.redeploymentFollowUpAt) continue;
    try {
      const milestone = dueMilestone(daysUntilDue(row.redeploymentFollowUpAt, now), RULE);
      if (!milestone) continue;
      addTally(
        result,
        await notifyOwner(
          row.redeploymentOwnerId,
          "Redeployment follow-up",
          "An available worker is due for a redeployment follow-up. Check the redeployment list.",
          "INFO",
          "/ta/workforce?tab=redeployment",
          { dedupeKey: reminderKey("redeploy-followup", row.id, row.redeploymentFollowUpAt, milestone), sendEmail: false }
        )
      );
    } catch (error) {
      result.failedCount++;
      safeLogError(`redeploy-followup reminder for employee ${row.id}`, error);
    }
  }
  return result;
};
