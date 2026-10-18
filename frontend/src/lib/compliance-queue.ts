import { formatDate } from "./utils";
import { getManilaToday, toManilaDateInput } from "./field-limits";
import type { Application } from "./types";

export type UrgencyCategory = "OVERDUE" | "UPCOMING" | "HEALTHY" | "NO_TARGET";

export interface UrgencyStatus {
  category: UrgencyCategory;
  label: string;
  variant: "danger" | "warning" | "primary" | "neutral";
  diffDays: number | null;
}

/** Due date of a follow-up: the updated-copy deadline when one is open, otherwise the To Follow target. */
export function getFollowUpTargetDate(req: {
  toFollowExpectedAt?: string | null;
  updateRequestDeadline?: string | null;
  updateRequestedAt?: string | null;
  updateRequestCompletedAt?: string | null;
}): string | null {
  const updateOpen = req.updateRequestedAt && !req.updateRequestCompletedAt;
  return (updateOpen && req.updateRequestDeadline) || req.toFollowExpectedAt || null;
}

export function calculateDaysOnSite(startDateStr?: string | null): number | null {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const todayParts = getManilaToday().split("-").map(Number);
  const todayUtc = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);

  // Dates are stored as Manila midnight (e.g. 2026-10-19T16:00Z), so read the Manila calendar day, not the UTC one.
  const datePart = toManilaDateInput(startDateStr);
  const startParts = datePart.split("-").map(Number);
  const startUtc = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);

  const diff = Math.floor((todayUtc - startUtc) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function calculateUrgencyStatus(toFollowExpectedAt?: string | null): UrgencyStatus {
  if (!toFollowExpectedAt) {
    return {
      category: "NO_TARGET",
      label: "No target date",
      variant: "neutral",
      diffDays: null,
    };
  }

  const todayParts = getManilaToday().split("-").map(Number);
  const todayUtc = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);

  const datePart = toManilaDateInput(toFollowExpectedAt);
  const targetParts = datePart.split("-").map(Number);
  const targetUtc = Date.UTC(targetParts[0], targetParts[1] - 1, targetParts[2]);

  const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysPast = Math.abs(diffDays);
    return {
      category: "OVERDUE",
      label: `Overdue (${daysPast} ${daysPast === 1 ? "day" : "days"})`,
      variant: "danger",
      diffDays,
    };
  }

  if (diffDays <= 7) {
    return {
      category: "UPCOMING",
      label: `Due in ${diffDays} ${diffDays === 1 ? "day" : "days"}`,
      variant: "warning",
      diffDays,
    };
  }

  return {
    category: "HEALTHY",
    label: `Target: ${formatDate(toFollowExpectedAt)}`,
    variant: "primary",
    diffDays,
  };
}

/** One badge per distinct urgency, e.g. two documents due tomorrow show as "Due in 1 day (2)". */
export function groupUrgencyStatuses(dates: (string | null | undefined)[]): UrgencyStatus[] {
  const groups = new Map<string, UrgencyStatus & { count: number }>();
  for (const date of dates) {
    const urgency = calculateUrgencyStatus(date);
    const existing = groups.get(urgency.label);
    if (existing) existing.count += 1;
    else groups.set(urgency.label, { ...urgency, count: 1 });
  }
  return [...groups.values()]
    .sort((a, b) => (a.diffDays ?? Infinity) - (b.diffDays ?? Infinity))
    .map(({ count, ...urgency }) => ({
      ...urgency,
      label: count > 1 ? `${urgency.label} (${count})` : urgency.label,
    }));
}

export function getWorkerUrgencyCategory(app: Application): UrgencyCategory {
  const pendingReqs = (app.complianceRequirements || []).filter(
    (r) => r.reviewStatus !== "APPROVED"
  );
  if (pendingReqs.length === 0) return "HEALTHY";

  const categories = pendingReqs.map((r) => calculateUrgencyStatus(getFollowUpTargetDate(r)).category);
  if (categories.includes("OVERDUE")) return "OVERDUE";
  if (categories.includes("UPCOMING")) return "UPCOMING";
  if (categories.includes("HEALTHY")) return "HEALTHY";
  return "NO_TARGET";
}
