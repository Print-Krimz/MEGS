import { ApplicationStatus, DeploymentStatus } from "./types/enums";

export type TAStatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export const TA_STATUS_TONE_CLASSES: Record<TAStatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-300",
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-800 border-rose-200",
  brand: "bg-teal-50 text-teal-800 border-teal-200",
};

export const TA_STATUS_TONE_TEXT_CLASSES: Record<TAStatusTone, string> = {
  neutral: "text-slate-700",
  info: "text-blue-600",
  success: "text-emerald-700",
  warning: "text-orange-700",
  danger: "text-red-600",
  brand: "text-teal-700",
};

/**
 * One visual language for workflow states. The label remains visible so color
 * is a helpful cue, never the only way to understand a status.
 */
export function getTaStatusTone(status?: string | null): TAStatusTone {
  const key = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[\s-]+/g, "_");

  if ([
    "OPEN",
    "ACTIVE",
    "ACTIVE_CLIENT",
    "ACTIVE_EMPLOYEE",
    "ACTIVE_ON_SITE",
    "APPROVED",
    "DEPLOYED",
  ].includes(key)) return "success";

  if (["NORMAL"].includes(key)) return "info";

  if (["LOW", "CLOSED", "INACTIVE", "ARCHIVED"].includes(key)) return "neutral";

  if ([
    "SUBMITTED",
    "PARSING",
    "REVIEW",
    "UNDER_REVIEW",
    "INITIAL_SCREENING",
    "CLIENT_ENDORSEMENT",
    "FINAL_INTERVIEW",
    "MATCHED",
    "SCHEDULED_FOR_SITE",
    "IN_PROGRESS",
  ].includes(key)) return "info";

  if ([
    "FILLED",
    "CONTRACT_AND_ORIENTATION",
    "TALENT_POOL",
    "ASSIGNMENT_COMPLETED",
    "AVAILABLE_FOR_REDEPLOYMENT",
  ].includes(key)) return "brand";

  if (["DRAFT", "ON_HOLD", "PENDING", "REQUIREMENTS", "NEEDS_ATTENTION", "HIGH", "ASAP"].includes(key)) return "warning";

  if (["CANCELLED", "WITHDRAWN", "BACKOUT", "EXPIRED", "SEPARATED", "REJECTED", "URGENT"].includes(key)) return "danger";

  return "neutral";
}

export function formatPriority(priority?: string | null): string {
  if (!priority) return "Normal";
  const labels: Record<string, string> = {
    LOW: "Low",
    NORMAL: "Normal",
    HIGH: "High",
    URGENT: "Urgent",
  };
  return labels[priority] || priority.replace(/_/g, " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

export function getTargetDateTone(targetDate?: string | null): TAStatusTone {
  if (!targetDate || targetDate.toUpperCase() === "ASAP") return "warning";
  const date = new Date(targetDate);
  if (Number.isNaN(date.getTime())) return "neutral";
  if (date.getTime() < Date.now()) return "danger";
  if (date.getTime() - Date.now() <= 48 * 60 * 60 * 1000) return "warning";
  return "info";
}

/** User-facing vocabulary for the Talent Acquisition workspace. */
export const TA_COPY = {
  navigation: {
    overview: "Overview",
    applications: "Applications",
    openings: "Job Openings",
    manpowerRequests: "Manpower Requests (MRF)",
    candidatePool: "Candidate Pool",
    interviews: "Interviews",
    clients: "Clients",
    workforce: "Workforce",
    reports: "Reports",
  },
  pipeline: {
    submitted: "Submitted",
    initialScreening: "Initial review",
    clientEndorsement: "Client review",
    finalInterview: "Final interview",
    requirements: "Requirements",
    contractAndOrientation: "Contract & orientation",
    deployed: "Deployed",
  },
} as const;

export function formatTaStatus(status?: string | null): string {
  if (!status) return "Unknown";
  const labels: Record<string, string> = {
    [ApplicationStatus.SUBMITTED]: TA_COPY.pipeline.submitted,
    [ApplicationStatus.PARSING]: "Resume review",
    [ApplicationStatus.REVIEW]: "Under review",
    [ApplicationStatus.NEEDS_ATTENTION]: "Needs attention",
    [ApplicationStatus.MATCHED]: "Match found",
    [ApplicationStatus.TALENT_POOL]: "Candidate pool",
    [ApplicationStatus.INITIAL_SCREENING]: TA_COPY.pipeline.initialScreening,
    [ApplicationStatus.CLIENT_ENDORSEMENT]: TA_COPY.pipeline.clientEndorsement,
    [ApplicationStatus.FINAL_INTERVIEW]: TA_COPY.pipeline.finalInterview,
    [ApplicationStatus.HIRED]: "Selected",
    [ApplicationStatus.COMPLIANCE]: TA_COPY.pipeline.requirements,
    [ApplicationStatus.ONBOARDING]: TA_COPY.pipeline.contractAndOrientation,
    [ApplicationStatus.CONTRACT_AND_ORIENTATION]: TA_COPY.pipeline.contractAndOrientation,
    [ApplicationStatus.DEPLOYED]: TA_COPY.pipeline.deployed,
    [ApplicationStatus.BACKOUT]: "Withdrawn",
    [ApplicationStatus.ARCHIVED]: "Archived",
    [DeploymentStatus.READY_FOR_DEPLOYMENT]: "Scheduled for site",
    [DeploymentStatus.ACTIVE]: "Active on site",
    [DeploymentStatus.ENDED]: "Assignment completed",
    [DeploymentStatus.CANCELLED]: "Cancelled",
  };
  return labels[status] || status.replace(/_/g, " ").toLowerCase().replace(/^./, (char) => char.toUpperCase());
}

export function formatInterviewDeadlineStatus(status?: string | null): string {
  switch (status) {
    case "BREACHED":
      return "Overdue";
    case "WARNING":
      return "Due within 48 hours";
    case "HEALTHY":
      return "On track";
    default:
      return formatTaStatus(status);
  }
}
