import type { AuditCategory, AuditLog } from "../types/admin.types";

export const ACTION_LABELS: Record<string, string> = {
  // Authentication
  USER_LOGGED_IN: "User Logged In",
  USER_LOGGED_OUT: "User Logged Out",
  FAILED_LOGIN_ATTEMPT: "Failed Login Attempt",
  PASSWORD_RESET_REQUESTED: "Password Reset Requested",
  PASSWORD_RESET_COMPLETED: "Password Reset Completed",
  PASSWORD_CHANGED: "Password Changed",
  ACCOUNT_ACTIVATED: "Account Activated",
  USER_REGISTERED: "User Registered",

  // User Management
  INVITED_TA: "Talent Acquisition Specialist Invited",
  USER_INVITED: "User Invited",
  USER_ROLE_UPDATED: "User Role Updated",
  USER_ACTIVATED: "User Account Activated",
  USER_DEACTIVATED: "User Account Deactivated",
  USER_STATUS_UPDATED: "User Status Updated",

  // Recruitment
  APPLICATION_SUBMITTED: "Job Application Submitted",
  APPLICATION_STATUS_UPDATED: "Application Stage Updated",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  INTERVIEW_RESULT_RECORDED: "Interview Result Recorded",
  CLIENT_ENDORSEMENT_RECORDED: "Candidate Endorsed to Client",
  CLIENT_ENDORSEMENT_UPDATED: "Client Endorsement Decision Updated",
  CANDIDATE_HIRED: "Candidate Hired",
  MRF_CREATED: "Manpower Request Created",
  MRF_UPDATED: "Manpower Request Updated",
  JOB_POSTING_CREATED: "Job Posting Created",
  JOB_POSTING_UPDATED: "Job Posting Updated",

  // Talent Pool
  KNN_TALENT_POOL_SEARCH: "Talent Pool Search Performed",
  TALENT_POOL_SEARCH: "Talent Pool Search Performed",
  KNN_TALENT_POOL_QUERY: "Talent Pool Matching Queried",
  KNN_SIMILAR_CANDIDATES_QUERY: "Similar Candidates Search Performed",
  TALENT_POOL_MEMBER_ADDED: "Candidate Added to Talent Pool",
  TALENT_POOL_CONTACT_LOGGED: "Talent Pool Contact Logged",
  TALENT_POOL_REACTIVATION: "Talent Pool Candidate Reactivated",

  // Configuration
  CANDIDATE_SCORING_CONFIGURATION_ACTIVATED: "Scoring Configuration Activated",
  SCORING_CONFIG_ACTIVATED: "Scoring Configuration Activated",
  SCORING_DEFAULTS_RESTORED: "Scoring Defaults Restored",

  // Compliance
  COMPLIANCE_REQUIREMENT_CREATED: "Compliance Requirement Created",
  COMPLIANCE_REQUIREMENT_REVIEWED: "Compliance Document Reviewed",

  // Deployment
  DEPLOYMENT_CREATED: "Candidate Deployed to Client",
  EMPLOYEE_DEPLOYED: "Candidate Deployed to Client",
  DEPLOYMENT_STATUS_UPDATED: "Deployment Status Updated",
  EMPLOYEE_STATUS_UPDATED: "Employee Status Updated",
  DEPLOYMENT_ENDED: "Deployment Concluded",
};

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "Authentication",
  "User Management",
  "Recruitment",
  "Talent Pool",
  "Configuration",
  "Compliance",
  "Deployment",
  "Security",
];

const ACTION_CATEGORY_MAP: Record<string, AuditCategory> = {
  USER_LOGGED_IN: "Authentication",
  USER_LOGGED_OUT: "Authentication",
  FAILED_LOGIN_ATTEMPT: "Authentication",
  PASSWORD_RESET_REQUESTED: "Authentication",
  PASSWORD_RESET_COMPLETED: "Authentication",
  PASSWORD_CHANGED: "Authentication",
  ACCOUNT_ACTIVATED: "Authentication",
  USER_REGISTERED: "Authentication",

  INVITED_TA: "User Management",
  USER_INVITED: "User Management",
  USER_ROLE_UPDATED: "User Management",
  USER_ACTIVATED: "User Management",
  USER_DEACTIVATED: "User Management",
  USER_STATUS_UPDATED: "User Management",

  APPLICATION_SUBMITTED: "Recruitment",
  APPLICATION_STATUS_UPDATED: "Recruitment",
  INTERVIEW_SCHEDULED: "Recruitment",
  INTERVIEW_RESULT_RECORDED: "Recruitment",
  CLIENT_ENDORSEMENT_RECORDED: "Recruitment",
  CLIENT_ENDORSEMENT_UPDATED: "Recruitment",
  CANDIDATE_HIRED: "Recruitment",
  MRF_CREATED: "Recruitment",
  MRF_UPDATED: "Recruitment",
  JOB_POSTING_CREATED: "Recruitment",
  JOB_POSTING_UPDATED: "Recruitment",

  KNN_TALENT_POOL_SEARCH: "Talent Pool",
  TALENT_POOL_SEARCH: "Talent Pool",
  KNN_TALENT_POOL_QUERY: "Talent Pool",
  KNN_SIMILAR_CANDIDATES_QUERY: "Talent Pool",
  TALENT_POOL_MEMBER_ADDED: "Talent Pool",
  TALENT_POOL_CONTACT_LOGGED: "Talent Pool",
  TALENT_POOL_REACTIVATION: "Talent Pool",

  CANDIDATE_SCORING_CONFIGURATION_ACTIVATED: "Configuration",
  SCORING_CONFIG_ACTIVATED: "Configuration",
  SCORING_DEFAULTS_RESTORED: "Configuration",

  COMPLIANCE_REQUIREMENT_CREATED: "Compliance",
  COMPLIANCE_REQUIREMENT_REVIEWED: "Compliance",

  DEPLOYMENT_CREATED: "Deployment",
  EMPLOYEE_DEPLOYED: "Deployment",
  DEPLOYMENT_STATUS_UPDATED: "Deployment",
  EMPLOYEE_STATUS_UPDATED: "Deployment",
  DEPLOYMENT_ENDED: "Deployment",
};

/**
 * Converts developer action keys to clean administrative labels.
 */
export function formatAction(action: string): string {
  if (!action) return "System Action";
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  // Convert UNDERSCORE_CASE to Title Case fallback
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Returns the audit category for a given action.
 */
export function getActionCategory(action: string): AuditCategory {
  if (ACTION_CATEGORY_MAP[action]) {
    return ACTION_CATEGORY_MAP[action];
  }
  if (action.includes("LOGIN") || action.includes("AUTH") || action.includes("PASSWORD")) {
    return "Authentication";
  }
  if (action.includes("USER") || action.includes("ROLE") || action.includes("STATUS")) {
    return "User Management";
  }
  if (action.includes("TALENT_POOL") || action.includes("KNN")) {
    return "Talent Pool";
  }
  if (action.includes("SCORING") || action.includes("CONFIG")) {
    return "Configuration";
  }
  if (action.includes("COMPLIANCE") || action.includes("DOCUMENT")) {
    return "Compliance";
  }
  if (action.includes("DEPLOY") || action.includes("EMPLOYEE")) {
    return "Deployment";
  }
  return "Recruitment";
}

/**
 * Returns tailwind CSS classes for audit category badges.
 */
export function getCategoryBadgeClass(category: AuditCategory): string {
  switch (category) {
    case "Authentication":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "User Management":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Recruitment":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "Talent Pool":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Configuration":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Compliance":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "Deployment":
      return "bg-cyan-50 text-cyan-800 border-cyan-200";
    case "Security":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/**
 * Safely parses audit details JSON payload.
 */
export function parseDetails(details: any): Record<string, any> {
  if (!details) return {};
  if (typeof details === "object") return details;
  try {
    return JSON.parse(details);
  } catch {
    return {};
  }
}

/**
 * Humanizes IP addresses (e.g., translates ::1 or 127.0.0.1 to Localhost).
 */
export function formatIpAddress(ip?: string | null): string {
  if (!ip || ip === "unknown") return "—";
  const cleanIp = ip.replace(/^::ffff:/, "").trim();
  if (cleanIp === "::1" || cleanIp === "127.0.0.1") {
    return `Localhost (${cleanIp})`;
  }
  return cleanIp;
}

/**
 * Resolves target entity into descriptive, administrator-friendly text.
 * Prevents raw 'User #' or 'TalentPool #' glitches.
 */
export function formatTargetEntity(log: AuditLog): {
  type: string;
  label: string;
  secondary?: string;
} {
  const details = parseDetails(log.details);
  const entity = log.entity || "";
  const entityId = log.entityId;

  // 1. User Entity
  if (entity === "User" || (!entity && log.action.includes("USER"))) {
    const targetEmail = details.targetEmail || details.email || details.attemptedEmail;
    const targetName = details.firstName || details.lastName
      ? `${details.firstName || ""} ${details.lastName || ""}`.trim()
      : undefined;

    if (targetName && targetEmail) {
      return { type: "User Account", label: targetName, secondary: targetEmail };
    }
    if (targetEmail) {
      return { type: "User Account", label: targetEmail };
    }
    if (log.user?.email) {
      return { type: "User Account", label: log.user.email };
    }
    return { type: "User Account", label: entityId ? `User #${entityId}` : "User Account" };
  }

  // 2. Application Entity
  if (entity === "Application" || log.action.includes("APPLICATION") || log.action.includes("INTERVIEW") || log.action.includes("ENDORSEMENT")) {
    const jobTitle = details.jobTitle;
    const applicant = details.applicantName || details.applicantEmail;
    const appLabel = entityId ? `App #${entityId}` : "Application";

    if (jobTitle && applicant) {
      return {
        type: "Application",
        label: `${appLabel} • ${jobTitle}`,
        secondary: applicant,
      };
    }
    if (jobTitle) {
      return { type: "Application", label: `${appLabel} • ${jobTitle}` };
    }
    if (applicant) {
      return { type: "Application", label: `${appLabel} • ${applicant}` };
    }
    return { type: "Application", label: entityId ? `Application #${entityId}` : "Job Application" };
  }

  // 3. Talent Pool Entity
  if (entity.includes("TalentPool") || entity === "ApplicantProfile" || log.action.includes("TALENT_POOL")) {
    const candidateName = details.candidateName || details.applicantName;
    if (candidateName) {
      return { type: "Talent Pool", label: `Candidate: ${candidateName}` };
    }
    if (details.targetJobId) {
      return { type: "Talent Pool", label: "Talent Pool Candidate", secondary: `Target Job #${details.targetJobId}` };
    }
    return { type: "Talent Pool", label: "Talent Pool Candidate" };
  }

  // 4. Candidate Scoring Configuration
  if (entity.includes("CandidateScoringConfiguration") || entity.includes("Scoring") || log.action.includes("SCORING")) {
    const version = details.version ? `v${details.version}` : "";
    return {
      type: "Configuration",
      label: `Candidate Scoring ${version ? `${version} (Global)` : "Configuration"}`,
      secondary: details.isDefault ? "Default Preset" : undefined,
    };
  }

  // 5. Deployment / Employee
  if (entity === "Deployment" || entity === "Employee" || log.action.includes("DEPLOY")) {
    const clientName = details.clientName;
    const site = details.site;
    const depLabel = entityId ? `Deployment #${entityId}` : "Deployment";

    if (clientName) {
      return {
        type: "Deployment",
        label: `${depLabel} • ${clientName}`,
        secondary: site ? `Site: ${site}` : undefined,
      };
    }
    return { type: "Deployment", label: entityId ? `Deployment #${entityId}` : "Candidate Deployment" };
  }

  // 6. Compliance Requirement
  if (entity === "ComplianceRequirement" || log.action.includes("COMPLIANCE")) {
    const doc = details.documentLabel;
    return {
      type: "Compliance",
      label: doc ? `Document: ${doc}` : "Compliance Requirement",
      secondary: entityId ? `Requirement #${entityId}` : undefined,
    };
  }

  // 7. Manpower Request (MRF)
  if (entity === "ManpowerRequest" || log.action.includes("MRF")) {
    const title = details.title;
    const client = details.clientName;
    const mrfLabel = entityId ? `MRF #${entityId}` : "Manpower Request";
    return {
      type: "Manpower Request",
      label: title ? `${mrfLabel} • ${title}` : mrfLabel,
      secondary: client ? `Client: ${client}` : undefined,
    };
  }

  // 8. Job Posting
  if (entity === "JobPosting" || log.action.includes("JOB_POSTING")) {
    const title = details.title;
    const jobLabel = entityId ? `Job #${entityId}` : "Job Posting";
    return {
      type: "Job Posting",
      label: title ? `${jobLabel} • ${title}` : jobLabel,
      secondary: details.location ? `Location: ${details.location}` : undefined,
    };
  }

  // Fallback
  if (entity) {
    return {
      type: entity,
      label: entityId ? `${entity} #${entityId}` : entity,
    };
  }

  return { type: "System", label: "Global System" };
}

/**
 * Extracts key metadata pairs to present cleanly in the Admin Details Modal.
 */
export function extractDisplayDetails(log: AuditLog): Array<{ label: string; value: string }> {
  const details = parseDetails(log.details);
  const items: Array<{ label: string; value: string }> = [];

  if (details.targetEmail) {
    items.push({ label: "Target Account Email", value: String(details.targetEmail) });
  } else if (details.attemptedEmail) {
    items.push({ label: "Attempted Email", value: String(details.attemptedEmail) });
  }

  if (details.previousRole && details.newRole) {
    items.push({
      label: "Role Transition",
      value: `${details.previousRole} → ${details.newRole}`,
    });
  }

  if (details.fromStatus && details.toStatus) {
    items.push({
      label: "Stage Transition",
      value: `${details.fromStatus} → ${details.toStatus}`,
    });
  }

  if (details.jobTitle) {
    items.push({ label: "Job Position", value: String(details.jobTitle) });
  }

  if (details.applicantName) {
    items.push({ label: "Applicant Name", value: String(details.applicantName) });
  }

  if (details.clientName) {
    items.push({ label: "Client Organization", value: String(details.clientName) });
  }

  if (details.site) {
    items.push({ label: "Work / Deployment Site", value: String(details.site) });
  }

  if (details.documentLabel) {
    items.push({ label: "Document Name", value: String(details.documentLabel) });
  }

  if (details.type && log.action.includes("INTERVIEW")) {
    items.push({ label: "Interview Type", value: String(details.type).replace(/_/g, " ") });
  }

  if (details.result) {
    items.push({ label: "Interview Result", value: String(details.result) });
  }

  if (details.outcome) {
    items.push({ label: "Decision Outcome", value: String(details.outcome) });
  }

  if (details.version !== undefined) {
    items.push({ label: "Configuration Version", value: `v${details.version}` });
  }

  if (details.reason) {
    items.push({ label: "Action Notes / Reason", value: String(details.reason) });
  }

  if (details.reviewNotes) {
    items.push({ label: "Review Notes", value: String(details.reviewNotes) });
  }

  return items;
}
