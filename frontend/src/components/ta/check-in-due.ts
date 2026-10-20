import { getManilaToday } from "../../lib/field-limits";
import { formatDate } from "../../lib/utils";
import { plural } from "../../lib/plural";

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(dateOnly: string): number {
  return Math.floor(new Date(`${dateOnly.slice(0, 10)}T00:00:00Z`).getTime() / DAY_MS);
}

/** Wording and tone for the "Check-in due" cell. Dates are compared as Manila calendar days. */
export function checkInDue(nextReviewAt?: string | null): { label: string; overdue: boolean } {
  if (!nextReviewAt) return { label: "Not scheduled", overdue: false };
  const days = dayNumber(nextReviewAt.slice(0, 10)) - dayNumber(getManilaToday());
  if (days < 0) return { label: `Overdue by ${plural(-days, "day")}`, overdue: true };
  if (days === 0) return { label: "Due today", overdue: false };
  return { label: `Due ${formatDate(nextReviewAt)}`, overdue: false };
}
