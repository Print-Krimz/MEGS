import { formatDate } from "./utils";
import { getManilaToday } from "./field-limits";
import type { Application } from "./types";

export type UrgencyCategory = "OVERDUE" | "UPCOMING" | "HEALTHY" | "NO_TARGET";

export interface UrgencyStatus {
  category: UrgencyCategory;
  label: string;
  variant: "danger" | "warning" | "primary" | "neutral";
  diffDays: number | null;
}

export function calculateDaysOnSite(startDateStr?: string | null): number | null {
  if (!startDateStr) return null;
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return null;

  const todayParts = getManilaToday().split("-").map(Number);
  const todayUtc = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);

  const datePart = startDateStr.includes("T") ? startDateStr.split("T")[0] : startDateStr;
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

  const datePart = toFollowExpectedAt.includes("T")
    ? toFollowExpectedAt.split("T")[0]
    : toFollowExpectedAt;
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

export function getWorkerUrgencyCategory(app: Application): UrgencyCategory {
  const pendingReqs = (app.complianceRequirements || []).filter(
    (r) => r.reviewStatus !== "APPROVED"
  );
  if (pendingReqs.length === 0) return "HEALTHY";

  const categories = pendingReqs.map((r) => calculateUrgencyStatus(r.toFollowExpectedAt).category);
  if (categories.includes("OVERDUE")) return "OVERDUE";
  if (categories.includes("UPCOMING")) return "UPCOMING";
  if (categories.includes("HEALTHY")) return "HEALTHY";
  return "NO_TARGET";
}
