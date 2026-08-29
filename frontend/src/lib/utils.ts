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

export type ApplicationStatusAudience = "applicant" | "staff";

/**
 * Converts canonical workflow statuses into language that matches what each
 * audience needs to act on. Applicant labels deliberately avoid internal
 * processing and scoring terminology.
 */
export function getApplicationStatusPresentation(
  status?: string | null,
  audience: ApplicationStatusAudience = "staff"
): {
  label: string;
  badgeClass: string;
} {
  if (audience === "applicant") {
    switch (status) {
      case ApplicationStatus.PARSING:
      case ApplicationStatus.MATCHED:
        return { label: "Application received", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
      case ApplicationStatus.NEEDS_ATTENTION:
        return { label: "Action needed", badgeClass: "bg-amber-100 text-amber-800 border-amber-300" };
      case ApplicationStatus.COMPLIANCE:
        return { label: "Requirements", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" };
      case ApplicationStatus.TALENT_POOL:
        return { label: "Future Opportunities", badgeClass: "bg-violet-100 text-violet-800 border-violet-300" };
    }
  }

  switch (status) {
    case ApplicationStatus.SUBMITTED:
      return { label: "Submitted", badgeClass: "bg-slate-100 text-slate-700 border-slate-300" };
    case ApplicationStatus.PARSING:
      return { label: "Resume review in progress", badgeClass: "bg-purple-100 text-purple-800 border-purple-300" };
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
    case ApplicationStatus.COMPLIANCE:
      return { label: "Requirements", badgeClass: "bg-teal-100 text-teal-800 border-teal-300" };
    case ApplicationStatus.DEPLOYED:
      return { label: "Deployed", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300" };
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
 * Backwards-compatible staff presentation used by existing recruiter views.
 */
export function getApplicationStatusMeta(status?: string | null) {
  return getApplicationStatusPresentation(status, "staff");
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

/**
 * Mask an email address for privacy and security display
 * Example: juan.delacruz@gmail.com -> ju***********@gmail.com
 * Example: ab@gmail.com -> a*@gmail.com
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return trimmed;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex); // includes '@'

  if (local.length === 1) {
    return `*${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}*${domain}`;
  }
  if (local.length <= 4) {
    return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}${domain}`;
  }

  // Length > 4: Show first 2 characters, mask middle, keep domain
  const maskedLength = local.length - 2;
  return `${local.slice(0, 2)}${"*".repeat(maskedLength)}${domain}`;
}

/**
 * Extracts a numeric document ID from internal document routes or raw IDs
 * e.g. "/api/documents/123/download" -> 123
 * or "123" -> 123
 */
export function extractDocumentId(urlOrId?: string | number | null): number | null {
  if (urlOrId === null || urlOrId === undefined || urlOrId === "") return null;
  if (typeof urlOrId === "number") return isNaN(urlOrId) ? null : urlOrId;
  const match = String(urlOrId).match(/\/api\/documents\/(\d+)/);
  if (match && match[1]) {
    const parsed = parseInt(match[1], 10);
    return isNaN(parsed) ? null : parsed;
  }
  const directNum = parseInt(String(urlOrId), 10);
  return isNaN(directNum) ? null : directNum;
}

/**
 * Dynamic professional greeting based on time of day
 * 05:00 - 11:59 -> "Good morning, [Name]"
 * 12:00 - 17:59 -> "Good afternoon, [Name]"
 * 18:00 - 04:59 -> "Good evening, [Name]"
 * Fallback -> "Welcome, [Name]"
 */
export function getTimeBasedGreeting(name?: string | null, date: Date = new Date()): string {
  const hour = date.getHours();
  let salutation = "Welcome";
  if (hour >= 5 && hour < 12) {
    salutation = "Good morning";
  } else if (hour >= 12 && hour < 18) {
    salutation = "Good afternoon";
  } else {
    salutation = "Good evening";
  }
  const cleanName = name?.trim();
  return cleanName ? `${salutation}, ${cleanName}` : `${salutation}, Candidate`;
}

/**
 * Sanitizes and formats notification messages for the recipient audience.
 * Converts legacy raw status enum notifications (e.g., "moved to TALENT POOL", "moved to REVIEW")
 * into clear, professional, candidate-friendly phrasing.
 */
export function formatNotificationMessage(
  message?: string | null,
  role?: string
): string {
  if (!message) return "";

  // Only rewrite status update notices for applicant/candidate view
  if (!role || role === "APPLICANT") {
    if (
      message.includes("moved to TALENT POOL") ||
      message.includes("moved to TALENT_POOL") ||
      message.includes("added to Talent Pool")
    ) {
      return "You were not selected for this position, but your profile may be considered for future job opportunities that match your qualifications.";
    }

    if (message.includes("moved to REVIEW")) {
      return "Your application is currently under review.";
    }

    if (
      message.includes("moved to INITIAL_SCREENING") ||
      message.includes("moved to INITIAL SCREENING")
    ) {
      return "Your application has advanced to Initial Screening.";
    }

    if (
      message.includes("moved to CLIENT_ENDORSEMENT") ||
      message.includes("moved to CLIENT ENDORSEMENT")
    ) {
      return "Your application has been endorsed for client review.";
    }

    if (
      message.includes("moved to FINAL_INTERVIEW") ||
      message.includes("moved to FINAL INTERVIEW")
    ) {
      return "Your application has advanced to Final Interview.";
    }

    if (message.includes("moved to HIRED")) {
      return "Congratulations! You have been selected for the position.";
    }

    if (message.includes("moved to COMPLIANCE")) {
      return "Employment documents (201) are needed. Please submit the requested documents.";
    }

    if (message.includes("moved to DEPLOYED")) {
      return "You have been placed at your work site. Your employee record is ready.";
    }

    if (message.includes("moved to ARCHIVED")) {
      return "Your application consideration has concluded.";
    }
  }

  return message;
}

