import { formatTaStatus, TA_COPY } from "./ta-copy";

/** Turns an unknown enum code into readable text: "STATUS_CHANGE" becomes "Status change". */
export function humanizeEnum(code?: string | null): string {
  if (!code) return "Unknown";
  const text = String(code).trim().replace(/[_\s-]+/g, " ").toLowerCase();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lookup(map: Record<string, string>, code?: string | null): string {
  if (!code) return "Unknown";
  return map[String(code).toUpperCase()] ?? humanizeEnum(code);
}

/** Application stage, staff wording. Same text as the status chip. */
export function applicationStatusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return formatTaStatus(status);
}

/** Deployment status (READY_FOR_DEPLOYMENT, ACTIVE, ENDED, CANCELLED). */
export function deploymentStatusLabel(status?: string | null): string {
  if (!status) return "Unknown";
  return formatTaStatus(status);
}

/**
 * One row of deployment status history. A missing or INITIAL from-status is the
 * moment the deployment was created, so it reads "Created".
 */
export function deploymentHistoryLabel(status?: string | null): string {
  if (!status || String(status).toUpperCase() === "INITIAL") return "Created";
  return deploymentStatusLabel(status);
}

/** Employee record history events (backend EmploymentEventType). */
export function employmentEventLabel(eventType?: string | null): string {
  return lookup(
    {
      HIRED: "Hired",
      DEPLOYED: "Deployed",
      ASSIGNMENT_ENDED: "Assignment ended",
      REDEPLOYED: "Redeployed",
      STATUS_CHANGE: "Status changed",
      SEPARATED: "Left the agency",
    },
    eventType
  );
}

/** Employee record status (EmploymentStatus). */
export function employmentStatusLabel(status?: string | null): string {
  return lookup(
    {
      ACTIVE: "Active employee",
      INACTIVE: "Inactive",
      SEPARATED: "Separated",
      AVAILABLE_FOR_REDEPLOYMENT: "Available for redeployment",
    },
    status
  );
}

/** Interview type (INITIAL_SCREENING, FINAL_INTERVIEW). */
export function interviewTypeLabel(type?: string | null): string {
  return lookup(
    {
      INITIAL_SCREENING: TA_COPY.pipeline.initialScreening,
      FINAL_INTERVIEW: TA_COPY.pipeline.finalInterview,
    },
    type
  );
}

/** Interview result (PASS, FAIL, NO_SHOW, PENDING). */
export function interviewResultLabel(result?: string | null): string {
  return lookup(
    { PASS: "Passed", FAIL: "Not passed", NO_SHOW: "No show", PENDING: "Pending" },
    result
  );
}

/**
 * Requirement review status, one vocabulary for the whole TA workspace.
 * PENDING means the candidate has not uploaded yet.
 */
export function requirementStatusLabel(status?: string | null): string {
  return lookup(
    {
      PENDING: "Not submitted",
      SUBMITTED: "Submitted",
      APPROVED: "Approved",
      REJECTED: "Rejected",
      TO_FOLLOW: "To follow",
      EXPIRED: "Expired",
    },
    status
  );
}
