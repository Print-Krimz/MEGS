import { ApplicationStatus, DeploymentStatus, EmploymentStatus } from "./types/enums";

/**
 * Merge class names safely
 */
export function cn(...inputs: (string | boolean | undefined | null | Record<string, boolean>)[]): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === "string") {
      classes.push(input);
    } else if (typeof input === "object") {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(" ");
}

/**
 * Format ISO date string to human-friendly local date
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Format ISO date string with time
 */
export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Human relative time ("2 hours ago", "in 3 days")
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHours = Math.round(diffMin / 60);
    const diffDays = Math.round(diffHours / 24);

    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    if (Math.abs(diffDays) >= 1) return rtf.format(diffDays, "day");
    if (Math.abs(diffHours) >= 1) return rtf.format(diffHours, "hour");
    if (Math.abs(diffMin) >= 1) return rtf.format(diffMin, "minute");
    return "just now";
  } catch {
    return dateString;
  }
}

/**
 * Format score to 1 decimal place or percentage
 */
export function formatScore(score?: number | string | null): string {
  if (score === undefined || score === null || score === "") return "—";
  const num = typeof score === "string" ? parseFloat(score) : score;
  if (isNaN(num)) return "—";
  return num.toFixed(1);
}

/**
 * Map ApplicationStatus to readable title and semantic badge colors
 */
export function getApplicationStatusMeta(status?: string | null): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return { label: "Submitted", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
    case ApplicationStatus.PARSING:
      return { label: "Parsing Resume", badgeClass: "bg-purple-100 text-purple-800 border-purple-300 animate-pulse" };
    case ApplicationStatus.REVIEW:
      return { label: "Under Review", badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300" };
    case ApplicationStatus.NEEDS_ATTENTION:
      return { label: "Needs Attention", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" };
    case ApplicationStatus.MATCHED:
      return { label: "Matched", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
    case ApplicationStatus.INITIAL_SCREENING:
      return { label: "Initial Screening", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" };
    case ApplicationStatus.CLIENT_ENDORSEMENT:
      return { label: "Client Endorsement", badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300" };
    case ApplicationStatus.FINAL_INTERVIEW:
      return { label: "Final Interview", badgeClass: "bg-sky-100 text-sky-800 border-sky-300" };
    case ApplicationStatus.HIRED:
      return { label: "Hired", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case ApplicationStatus.ONBOARDING:
      return { label: "Onboarding", badgeClass: "bg-lime-100 text-lime-800 border-lime-300" };
    case ApplicationStatus.COMPLIANCE:
      return { label: "Compliance (201)", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" };
    case ApplicationStatus.DEPLOYED:
      return { label: "Deployed", badgeClass: "bg-green-100 text-green-800 border-green-300" };
    case ApplicationStatus.TALENT_POOL:
      return { label: "Talent Pool", badgeClass: "bg-violet-100 text-violet-800 border-violet-300" };
    case ApplicationStatus.BACKOUT:
      return { label: "Backed Out", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
    case ApplicationStatus.ARCHIVED:
      return { label: "Archived", badgeClass: "bg-gray-100 text-gray-600 border-gray-300" };
    default:
      return { label: status || "Unknown", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
  }
}

/**
 * Map DeploymentStatus to readable label and badge colors
 */
export function getDeploymentStatusMeta(status?: string | null): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case DeploymentStatus.READY_FOR_DEPLOYMENT:
      return { label: "Ready for Deployment", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" };
    case DeploymentStatus.ACTIVE:
      return { label: "Active", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case DeploymentStatus.ENDED:
      return { label: "Ended", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
    case DeploymentStatus.CANCELLED:
      return { label: "Cancelled", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
    default:
      return { label: status || "Unknown", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
  }
}

/**
 * Map EmploymentStatus to readable label and badge colors
 */
export function getEmploymentStatusMeta(status?: string | null): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case EmploymentStatus.ACTIVE:
      return { label: "Active Employee", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case EmploymentStatus.INACTIVE:
      return { label: "Inactive", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
    case EmploymentStatus.SEPARATED:
      return { label: "Separated", badgeClass: "bg-rose-100 text-rose-800 border-rose-300" };
    case EmploymentStatus.AVAILABLE_FOR_REDEPLOYMENT:
      return { label: "Available for Redeployment", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
    default:
      return { label: status || "Unknown", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
  }
}

/**
 * Get initials from names
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || "").trim().charAt(0).toUpperCase();
  const l = (lastName || "").trim().charAt(0).toUpperCase();
  return `${f}${l}` || "U";
}
