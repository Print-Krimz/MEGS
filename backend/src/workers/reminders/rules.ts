import { manilaDateString, manilaDaysUntil } from "../../schemas/field-limits.js";
import { sendNotification, type NotificationTally } from "../../utils/notification.js";

// Shared rules for every deadline reminder sweep.
// A date-only deadline is met for its whole Manila day; it is overdue only from the next Manila day.

export const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderResult {
  scannedCount: number;
  sentCount: number;
  duplicateCount: number;
  failedCount: number;
}

export const newResult = (): ReminderResult => ({ scannedCount: 0, sentCount: 0, duplicateCount: 0, failedCount: 0 });

export const addTally = (result: ReminderResult, tally: NotificationTally): void => {
  result.sentCount += tally.sent;
  result.duplicateCount += tally.duplicate;
  result.failedCount += tally.failed;
};

/** Overdue reminders stop after this many days, so old rows are not reloaded every hour forever. */
export const REMINDER_LOOKBACK_DAYS = 90;

/**
 * Catch-up emails stop after this many overdue days. Older items still get in-app reminders,
 * so the first run after a gap does not flood applicants' inboxes with stale notices.
 */
export const EMAIL_CATCHUP_DAYS = 14;

export const withinEmailCatchup = (daysUntil: number): boolean => daysUntil >= -EMAIL_CATCHUP_DAYS;

/** A SQL lower bound: due dates older than the lookback window are left alone. */
export const dueSince = (now: Date): Date => new Date(now.getTime() - (REMINDER_LOOKBACK_DAYS + 1) * DAY_MS);

/** A SQL upper bound for "due within N days". Generous on purpose; manilaDaysUntil makes the exact call. */
export const dueWithin = (now: Date, days: number): Date => new Date(now.getTime() + (days + 1) * DAY_MS);

export interface MilestoneRule {
  /** Send `soon` while 0 < daysUntil <= soonDays. */
  soonDays?: number;
  /** Send `today` on the due day. */
  today?: boolean;
  /** Send overdue reminders, one more every this many days. Infinity = only once. Undefined = never. */
  overdueEvery?: number;
}

/** The milestone a record is in right now for this rule, or null when nothing is due to be sent. */
export const dueMilestone = (daysUntil: number, rule: MilestoneRule): string | null => {
  if (daysUntil > 0) return rule.soonDays !== undefined && daysUntil <= rule.soonDays ? "soon" : null;
  if (daysUntil === 0) return rule.today ? "today" : null;
  if (rule.overdueEvery === undefined) return null;
  return `overdue-${Math.floor((-daysUntil - 1) / rule.overdueEvery)}`;
};

/** Document expiry: only the latest milestone that applies (no backlog of older ones). */
export const expiryMilestone = (daysUntil: number): string | null => {
  if (daysUntil < 0) return "expired";
  if (daysUntil <= 7) return "expiring-7";
  if (daysUntil <= 30) return "expiring-30";
  return null;
};

/** Contract end: a deployment that has passed its end date is handled by ending it, not by reminders. */
export const contractMilestone = (daysUntil: number): string | null => {
  if (daysUntil < 0) return null;
  if (daysUntil === 0) return "today";
  return expiryMilestone(daysUntil);
};

export const daysUntilDue = (due: Date, now: Date): number => manilaDaysUntil(due, now);

/** "<kind>:<recordId>:<due YYYY-MM-DD in Manila>:<milestone>". notifyOwner adds ":<recipientId>". */
export const reminderKey = (kind: string, recordId: number | string, due: Date, milestone: string): string =>
  `${kind}:${recordId}:${manilaDateString(due)}:${milestone}`;

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export const formatDue = (due: Date): string => dateFormat.format(due);

export const isOverdue = (milestone: string): boolean => milestone.startsWith("overdue-");

/** Sends to one applicant with a per-user dedupe key. Never throws. */
export const notifyApplicant = async (
  userId: string,
  title: string,
  message: string,
  type: "INFO" | "WARNING",
  link: string,
  options: { dedupeKey: string; sendEmail: boolean; ctaText?: string }
): Promise<NotificationTally> => {
  const tally: NotificationTally = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  tally[
    await sendNotification(userId, title, message, type, link, {
      dedupeKey: `${options.dedupeKey}:${userId}`,
      sendEmail: options.sendEmail,
      ctaText: options.ctaText,
    })
  ]++;
  return tally;
};
