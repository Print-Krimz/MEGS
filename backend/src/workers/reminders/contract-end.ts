import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { JOB_OWNER_SELECT, deploymentOwnerTaId } from "../../services/ta/ownership.js";
import { safeLogError } from "../../security/errors.js";
import { addTally, contractMilestone, daysUntilDue, dueSince, dueWithin, formatDue, newResult, reminderKey, type ReminderResult } from "./rules.js";

const LIVE_STATUSES = ["ACTIVE", "READY", "DISPATCHED", "READY_FOR_DEPLOYMENT"] as const;

/** Owner TA: 30 days, 7 days and on the day a contract ends. Only the latest milestone is sent. */
export const sendContractEndReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.deployment.findMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      contractEnd: { not: null, gte: dueSince(now), lte: dueWithin(now, 30) },
    },
    select: {
      id: true,
      contractEnd: true,
      mrfId: true,
      createdById: true,
      mrf: { select: { assignedTaId: true } },
      application: { select: { jobPosting: { select: JOB_OWNER_SELECT } } },
    },
  });

  const result = newResult();
  result.scannedCount = rows.length;

  for (const row of rows) {
    if (!row.contractEnd) continue;
    try {
      const milestone = contractMilestone(daysUntilDue(row.contractEnd, now));
      if (!milestone) continue;
      const ownerId = deploymentOwnerTaId(row);
      addTally(
        result,
        await notifyOwner(
          ownerId,
          "Contract ending",
          milestone === "today"
            ? `The contract for deployment #${row.id} ends today.`
            : `The contract for deployment #${row.id} ends on ${formatDue(row.contractEnd)}.`,
          "WARNING",
          `/ta/deployments/${row.id}`,
          {
            dedupeKey: reminderKey("contract-end", row.id, row.contractEnd, milestone),
            sendEmail: milestone !== "expiring-30",
            ctaText: "Open deployment",
          }
        )
      );
      // End day and still live: the TA did not renew or end it, so the Admins (team leaders) are told too.
      // An unassigned requisition already went to the Admins above, so skip it here.
      if (milestone === "today" && ownerId) {
        addTally(
          result,
          await notifyOwner(
            null,
            "Contract ends today",
            `The contract for deployment #${row.id} ends today and the deployment is still live. The assigned TA has been notified.`,
            "WARNING",
            row.mrfId ? `/admin/mrfs/${row.mrfId}` : null,
            {
              dedupeKey: reminderKey("contract-end-admin", row.id, row.contractEnd, "today"),
              sendEmail: true,
              ctaText: "Open hiring request",
            }
          )
        );
      }
    } catch (error) {
      result.failedCount++;
      safeLogError(`contract-end reminder for deployment ${row.id}`, error);
    }
  }
  return result;
};
