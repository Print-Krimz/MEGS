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
    "CONTRACT_SIGNING",
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

/**
 * User-facing vocabulary for the Talent Acquisition workspace.
 * Single source of truth: sidebar labels, page titles, chips, filters and history
 * all read from here. Sentence case everywhere.
 */
export const TA_COPY = {
  navigation: {
    overview: "Overview",
    applications: "Applications",
    openings: "Job openings",
    manpowerRequests: "Manpower requests",
    candidatePool: "Candidate pool",
    interviews: "Interviews",
    clients: "Clients",
    workforce: "Workforce",
    reports: "Reports",
  },
  /** Page titles. Same as the sidebar label unless a page needs a longer title. */
  pageTitles: {
    overview: "Overview",
    applications: "Applications",
    openings: "Job openings",
    manpowerRequests: "Manpower requests",
    createManpowerRequest: "Create manpower request",
    candidatePool: "Candidate pool",
    interviews: "Interviews",
    clients: "Clients",
    workforce: "Workforce",
    reports: "Reports",
    deployments: "Deployments",
    employeeRecords: "Employee records",
    preEmployment: "Pre-employment requirements",
    followUps: "Post-deployment follow-ups",
    redeployment: "Redeployment",
  },
  breadcrumbRoot: "Overview",
  pipeline: {
    submitted: "Submitted",
    initialScreening: "Initial screening",
    clientEndorsement: "Client review",
    finalInterview: "Final interview",
    requirements: "Requirements",
    contractSigning: "Contract signing",
    deployed: "Deployed",
  },
  /**
   * Deployment status labels.
   * An application at DEPLOYED gets a deployment in READY_FOR_DEPLOYMENT until the
   * worker starts. "Scheduled for site" read like a second, competing stage, so the
   * deployment label is "Ready to start" and the detail line is "Starts on <date>"
   * (see deploymentStartsOn). Stage reads "Deployed", deployment reads "Ready to start".
   */
  deployment: {
    readyToStart: "Ready to start",
    active: "Active on site",
    ended: "Assignment ended",
    cancelled: "Did not start",
    endedWantsAssignment: "Ended · wants another assignment",
    endedNotConfirmed: "Ended · not confirmed yet",
    endedLeftAgency: "Ended · left the agency",
  },
  /**
   * Workforce vocabulary: end-assignment dispositions, redeployment actions.
   * Filters and badges for ended assignments use TA_COPY.deployment.endedWantsAssignment etc.
   */
  workforce: {
    dispositions: {
      wantsAnother: "Wants another assignment",
      notConfirmed: "Not confirmed yet",
      leaving: "Leaving the agency",
    },
    actions: {
      findJob: "Find a job",
      sendInvitation: "Send invitation",
      inviteToApply: "Invite to apply",
    },
    invitedOn: (formattedDate: string) => `Invited ${formattedDate}`,
  },
  invitations: {
    sent: "Sent invitations",
    inviteToApply: "Invite to apply",
  },
  interviews: {
    recordOutcome: "Record outcome",
    saveOutcome: "Save outcome",
  },
  discard: {
    title: "Discard your changes?",
    description: "You have unsaved changes in this form.",
    keepEditing: "Keep editing",
    discard: "Discard",
  },
} as const;

/** "Starts on Oct 14, 2026" for a deployment that is ready to start. */
export function deploymentStartsOn(formattedDate: string): string {
  return `Starts on ${formattedDate}`;
}

/**
 * Staff stage labels: one name per stage, used by chips, the stepper, filters and history.
 * Applicant-facing labels live in getApplicationStatusPresentation (applicant audience).
 */
export const STAFF_STAGE_LABELS: Record<ApplicationStatus, string> = {
  [ApplicationStatus.SUBMITTED]: TA_COPY.pipeline.submitted,
  [ApplicationStatus.PARSING]: "Resume review",
  [ApplicationStatus.REVIEW]: "Under review",
  [ApplicationStatus.NEEDS_ATTENTION]: "Needs attention",
  [ApplicationStatus.MATCHED]: "Match found",
  [ApplicationStatus.TALENT_POOL]: TA_COPY.navigation.candidatePool,
  [ApplicationStatus.INITIAL_SCREENING]: TA_COPY.pipeline.initialScreening,
  [ApplicationStatus.CLIENT_ENDORSEMENT]: TA_COPY.pipeline.clientEndorsement,
  [ApplicationStatus.FINAL_INTERVIEW]: TA_COPY.pipeline.finalInterview,
  [ApplicationStatus.HIRED]: "Selected",
  [ApplicationStatus.COMPLIANCE]: TA_COPY.pipeline.requirements,
  [ApplicationStatus.ONBOARDING]: TA_COPY.pipeline.contractSigning,
  [ApplicationStatus.CONTRACT_SIGNING]: TA_COPY.pipeline.contractSigning,
  [ApplicationStatus.DEPLOYED]: TA_COPY.pipeline.deployed,
  [ApplicationStatus.BACKOUT]: "Backed out",
  [ApplicationStatus.REJECTED]: "Rejected",
  [ApplicationStatus.ARCHIVED]: "Archived",
};

const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  [DeploymentStatus.READY_FOR_DEPLOYMENT]: TA_COPY.deployment.readyToStart,
  [DeploymentStatus.ACTIVE]: TA_COPY.deployment.active,
  [DeploymentStatus.ENDED]: TA_COPY.deployment.ended,
  [DeploymentStatus.CANCELLED]: TA_COPY.deployment.cancelled,
};

export function formatTaStatus(status?: string | null): string {
  if (!status) return "Unknown";
  const labels: Record<string, string> = { ...STAFF_STAGE_LABELS, ...DEPLOYMENT_STATUS_LABELS };
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
