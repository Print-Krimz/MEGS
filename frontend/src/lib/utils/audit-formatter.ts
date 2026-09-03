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

  // Database Maintenance
  DATABASE_BACKUP_SUCCESS: "Database Backup Created",
  DATABASE_BACKUP_DOWNLOAD: "Database Backup Downloaded",
  DATABASE_RESTORE_SUCCESS: "Database Restored from Backup",
  DATABASE_BACKUP_RENAMED: "Database Backup Renamed",

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

  DATABASE_BACKUP_SUCCESS: "Configuration",
  DATABASE_BACKUP_DOWNLOAD: "Configuration",
  DATABASE_RESTORE_SUCCESS: "Configuration",
  DATABASE_BACKUP_RENAMED: "Configuration",

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
  if (
    action.includes("DATABASE") ||
    action.includes("BACKUP") ||
    action.includes("RESTORE") ||
    action.includes("MAINTENANCE")
  ) {
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
 * Converts enum roles into readable titles.
 */
export function formatRole(role?: string | null): string {
  if (!role) return "System";
  switch (role.toUpperCase()) {
    case "ADMINISTRATOR":
      return "Administrator";
    case "TALENT_ACQUISITION":
      return "Talent Acquisition Specialist";
    case "APPLICANT":
      return "Applicant";
    default:
      return role
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

/**
 * Converts enum pipeline stages into friendly titles.
 */
export function formatStage(stage?: string | null): string {
  if (!stage) return "N/A";
  switch (stage.toUpperCase()) {
    case "SUBMITTED":
      return "Submitted";
    case "INITIAL_SCREENING":
      return "Initial Screening";
    case "INTERVIEW":
      return "Interview";
    case "FINAL_INTERVIEW":
      return "Final Interview";
    case "CLIENT_REVIEW":
      return "Client Review";
    case "COMPLIANCE":
      return "Compliance";
    case "OFFER_EXTENDED":
      return "Offer Extended";
    case "HIRED":
      return "Hired";
    case "REJECTED":
      return "Rejected";
    case "WITHDRAWN":
      return "Withdrawn";
    default:
      return stage
        .toLowerCase()
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
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
  if (
    entity === "Application" ||
    log.action.includes("APPLICATION") ||
    log.action.includes("INTERVIEW") ||
    log.action.includes("ENDORSEMENT")
  ) {
    const jobTitle = details.jobTitle;
    const applicant = details.applicantName || details.applicantEmail;

    if (applicant && jobTitle) {
      return {
        type: "Candidate Application",
        label: applicant,
        secondary: jobTitle,
      };
    }
    if (applicant) {
      return { type: "Candidate Application", label: applicant };
    }
    if (jobTitle) {
      return { type: "Job Application", label: jobTitle };
    }
    return { type: "Candidate Application", label: "Job Candidate" };
  }

  // 3. Talent Pool Entity
  if (
    entity.includes("TalentPool") ||
    entity === "ApplicantProfile" ||
    log.action.includes("TALENT_POOL")
  ) {
    const candidateName = details.candidateName || details.applicantName;
    if (candidateName) {
      return {
        type: "Talent Pool",
        label: candidateName,
        secondary: details.targetJobTitle || "Talent Pool Candidate",
      };
    }
    return { type: "Talent Pool", label: "Talent Pool Candidate" };
  }

  // 4. Candidate Scoring Configuration
  if (
    entity.includes("CandidateScoringConfiguration") ||
    entity.includes("Scoring") ||
    log.action.includes("SCORING")
  ) {
    const version = details.version ? `v${details.version}` : "";
    return {
      type: "Matching Configuration",
      label: `Candidate Scoring ${version ? `${version} (Global)` : "Configuration"}`,
      secondary: details.isDefault ? "Default Preset" : undefined,
    };
  }

  // 5. Database Backup
  if (entity.includes("DatabaseBackup") || log.action.includes("DATABASE_BACKUP")) {
    return {
      type: "Database Backup",
      label: details.filename ? String(details.filename) : "System Database Snapshot",
      secondary: details.checksumSha256
        ? `SHA-256: ${String(details.checksumSha256).slice(0, 12)}...`
        : undefined,
    };
  }

  // 6. Deployment / Employee
  if (entity === "Deployment" || entity === "Employee" || log.action.includes("DEPLOY")) {
    const clientName = details.clientName;
    const candidate = details.employeeName || details.applicantName;
    const site = details.site;

    if (candidate && clientName) {
      return {
        type: "Deployment",
        label: candidate,
        secondary: `${clientName}${site ? ` • ${site}` : ""}`,
      };
    }
    if (clientName) {
      return {
        type: "Deployment",
        label: clientName,
        secondary: site ? `Site: ${site}` : undefined,
      };
    }
    return { type: "Deployment", label: "Candidate Deployment" };
  }

  // 7. Compliance Requirement
  if (entity === "ComplianceRequirement" || log.action.includes("COMPLIANCE")) {
    const doc = details.documentLabel;
    const candidate = details.applicantName;
    return {
      type: "Compliance",
      label: doc || "Compliance Requirement",
      secondary: candidate,
    };
  }

  // 8. Manpower Request (MRF)
  if (entity === "ManpowerRequest" || log.action.includes("MRF")) {
    const title = details.title;
    const client = details.clientName;
    return {
      type: "Manpower Request",
      label: title || "Manpower Request",
      secondary: client ? `Client: ${client}` : undefined,
    };
  }

  // 9. Job Posting
  if (entity === "JobPosting" || log.action.includes("JOB_POSTING")) {
    const title = details.title;
    return {
      type: "Job Posting",
      label: title || "Job Posting",
      secondary: details.location ? `Location: ${details.location}` : undefined,
    };
  }

  // Fallback
  if (entity) {
    return {
      type: entity,
      label: entity,
    };
  }

  return { type: "System", label: "Global System" };
}

export function formatInterviewType(type?: string | null): string {
  if (!type) return "Interview";
  const upper = type.toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    INITIAL_SCREENING: "Initial Screening",
    TECHNICAL_INTERVIEW: "Technical Interview",
    FINAL_INTERVIEW: "Final Client Interview",
    BEHAVIORAL_INTERVIEW: "Behavioral Interview",
    HR_INTERVIEW: "HR Interview",
  };
  return map[upper] || formatStage(type);
}

export function formatInterviewResult(result?: string | null): string {
  if (!result) return "";
  const upper = result.toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    PASS: "Passed",
    PASSED: "Passed",
    FAIL: "Did Not Pass",
    FAILED: "Did Not Pass",
    NO_SHOW: "No Show",
    PENDING: "Pending",
    SCHEDULED: "Scheduled",
    CANCELLED: "Cancelled",
  };
  return map[upper] || formatStage(result);
}

/**
 * Resolves the actor who performed the action into a clear, professional person/team name.
 * Never outputs robotic phrases like "System Routine" or raw "System".
 */
export function formatActor(log: AuditLog): {
  name: string;
  role?: string;
  email?: string;
} {
  const details = parseDetails(log.details);
  const user = log.user;

  // 1. If user object has first/last name from applicantProfile
  if (user?.applicantProfile?.firstName || user?.applicantProfile?.lastName) {
    const fullName = `${user.applicantProfile.firstName || ""} ${user.applicantProfile.lastName || ""}`.trim();
    return {
      name: fullName,
      role: formatRole(user.role),
      email: user.email,
    };
  }

  // 2. If user object has email
  if (user?.email) {
    return {
      name: user.email,
      role: formatRole(user.role),
      email: user.email,
    };
  }

  // 3. Extract explicit actor information from details payload if available
  const explicitActorName =
    details.actorName ||
    details.interviewerName ||
    details.evaluatorName ||
    details.recruiterName ||
    details.userName ||
    details.conductedBy ||
    details.changedBy;

  if (explicitActorName) {
    return {
      name: String(explicitActorName),
      role: details.actorRole ? formatRole(details.actorRole) : undefined,
      email: details.actorEmail ? String(details.actorEmail) : undefined,
    };
  }

  if (details.actorEmail) {
    return {
      name: String(details.actorEmail),
      role: details.actorRole ? formatRole(details.actorRole) : undefined,
    };
  }

  // 4. Fallback based on domain context — never display "System Routine" or "System"
  const action = (log.action || "").toUpperCase();
  const category = getActionCategory(log.action);

  if (action === "APPLICATION_SUBMITTED" || action.includes("APPLICANT")) {
    const candidateName = details.applicantName || details.name;
    return {
      name: candidateName ? String(candidateName) : "Job Applicant",
      role: "Applicant",
    };
  }

  // Backup & Restore actions always performed by Administrators
  if (
    action.includes("DATABASE_BACKUP") ||
    action.includes("DATABASE_RESTORE") ||
    action.includes("BACKUP") ||
    action.includes("RESTORE") ||
    action.includes("MAINTENANCE")
  ) {
    return {
      name: "System Administrator",
      role: "Administrator",
    };
  }

  if (
    category === "Recruitment" ||
    category === "Talent Pool" ||
    action.includes("INTERVIEW") ||
    action.includes("STAGE") ||
    action.includes("APPLICATION") ||
    action.includes("ENDORSEMENT") ||
    action.includes("ORIENTATION") ||
    action.includes("CONTRACT")
  ) {
    return {
      name: "Talent Acquisition Specialist",
      role: "Recruitment Team",
    };
  }

  if (category === "Compliance" || action.includes("COMPLIANCE")) {
    return {
      name: "Compliance Officer",
      role: "Verification Team",
    };
  }

  if (category === "Deployment" || action.includes("DEPLOY")) {
    return {
      name: "Deployment Coordinator",
      role: "Operations Team",
    };
  }

  if (category === "Configuration" || action.includes("BACKUP") || action.includes("MAINTENANCE")) {
    return {
      name: "System Administrator",
      role: "Administrator",
    };
  }

  if (category === "Authentication" || category === "Security") {
    return {
      name: details.attemptedEmail ? String(details.attemptedEmail) : "Security Administrator",
      role: "Security Audit",
    };
  }

  return {
    name: "Talent Acquisition Specialist",
    role: "Recruitment Team",
  };
}

/**
 * Extracts key metadata pairs to present cleanly in the Admin Details Modal.
 */
export function extractDisplayDetails(log: AuditLog): Array<{ label: string; value: string }> {
  const details = parseDetails(log.details);
  const items: Array<{ label: string; value: string }> = [];

  if (details.targetEmail) {
    items.push({ label: "Target Account", value: String(details.targetEmail) });
  } else if (details.attemptedEmail) {
    items.push({ label: "Account Email", value: String(details.attemptedEmail) });
  }

  if (details.applicantName) {
    items.push({ label: "Candidate", value: String(details.applicantName) });
  } else if (details.applicantEmail) {
    items.push({ label: "Candidate Email", value: String(details.applicantEmail) });
  }

  if (details.jobTitle) {
    items.push({ label: "Position", value: String(details.jobTitle) });
  }

  if (details.fromStatus && details.toStatus) {
    items.push({
      label: "Stage",
      value: `${formatStage(details.fromStatus)} → ${formatStage(details.toStatus)}`,
    });
  }

  if (details.previousRole && details.newRole) {
    items.push({
      label: "Role",
      value: `${formatRole(details.previousRole)} → ${formatRole(details.newRole)}`,
    });
  }

  if (details.reason) {
    items.push({ label: "Note", value: String(details.reason) });
  }

  if (details.clientName) {
    items.push({ label: "Client", value: String(details.clientName) });
  }

  if (details.site) {
    items.push({ label: "Work Site", value: String(details.site) });
  }

  if (details.documentLabel) {
    items.push({ label: "Document", value: String(details.documentLabel) });
  }

  if (details.type && log.action.includes("INTERVIEW")) {
    items.push({ label: "Interview", value: formatInterviewType(details.type) });
  }

  if (details.result) {
    items.push({ label: "Result", value: formatInterviewResult(details.result) });
  }

  if (details.outcome) {
    items.push({ label: "Outcome", value: formatStage(details.outcome) });
  }

  if (details.filename) {
    items.push({ label: "Backup File", value: String(details.filename) });
  }

  if (details.reviewNotes) {
    items.push({ label: "Review Notes", value: String(details.reviewNotes) });
  }

  return items;
}

export type AuditSeverity = "CRITICAL" | "WARNING" | "INFORMATIONAL";

/**
 * Evaluates audit log severity for security triage.
 */
export function getAuditSeverity(log: AuditLog): AuditSeverity {
  const action = (log.action || "").toUpperCase();
  const details = parseDetails(log.details);

  if (
    action.includes("FAILED") ||
    action.includes("FAILURE") ||
    action.includes("BREACH") ||
    action.includes("UNAUTHORIZED") ||
    action.includes("ATTACK") ||
    (action === "USER_ROLE_UPDATED" &&
      (String(details.newRole).toUpperCase() === "ADMINISTRATOR" ||
        String(details.newRole).toUpperCase() === "ADMIN"))
  ) {
    return "CRITICAL";
  }

  if (
    action.includes("DEACTIVAT") ||
    action.includes("REJECT") ||
    action.includes("PASSWORD_RESET") ||
    action.includes("CANCEL") ||
    action.includes("NO_SHOW") ||
    action === "DEPLOYMENT_ENDED"
  ) {
    return "WARNING";
  }

  return "INFORMATIONAL";
}

/**
 * Returns calibrated badge styles for audit severity levels.
 */
export function getAuditSeverityBadgeClass(severity: AuditSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-50 text-rose-800 border-rose-300 font-bold";
    case "WARNING":
      return "bg-amber-50 text-amber-900 border-amber-300 font-semibold";
    case "INFORMATIONAL":
      return "bg-slate-100 text-slate-700 border-slate-200 font-medium";
  }
}

/**
 * Generates clear, plain-language HCI responses for the 5 essential audit questions:
 * 1. What was detected?
 * 2. How severe is it?
 * 3. Where did it happen?
 * 4. Why does it matter?
 * 5. What should the user do?
 */
export function getAuditExplanation(log: AuditLog): {
  affectedModule: string;
  contextSummary: string;
  whyItMatters: string;
  recommendedAction: string;
} {
  const action = (log.action || "").toUpperCase();
  const category = getActionCategory(log.action);
  const details = parseDetails(log.details);

  // 1. Authentication
  if (category === "Authentication") {
    if (action.includes("FAILED")) {
      return {
        affectedModule: "Authentication & Identity",
        contextSummary: `Unsuccessful login attempt detected for account '${details.attemptedEmail || details.email || "Unknown"}'.`,
        whyItMatters: "Repeated failed attempts may indicate invalid credentials or unauthorized access attempts.",
        recommendedAction: "Monitor for multiple failed attempts from this IP. Lock the account if credential stuffing is suspected.",
      };
    }
    if (action.includes("PASSWORD_RESET")) {
      return {
        affectedModule: "Authentication & Security",
        contextSummary: `Password reset requested or completed for '${details.targetEmail || details.email || log.user?.email || "User Account"}'.`,
        whyItMatters: "Password changes modify security credentials and invalidate existing active sessions.",
        recommendedAction: "Confirm with the account owner if this password reset was unexpected.",
      };
    }
    return {
      affectedModule: "Authentication & Session",
      contextSummary: `User session event '${formatAction(log.action)}' recorded successfully.`,
      whyItMatters: "Maintains an immutable record of authorized system logins and logouts.",
      recommendedAction: "No action required. Standard operational activity.",
    };
  }

  // 2. User Management
  if (category === "User Management") {
    if (action === "USER_ROLE_UPDATED") {
      return {
        affectedModule: "User Access & Permissions",
        contextSummary: `Role transitioned from ${formatRole(details.previousRole)} to ${formatRole(details.newRole)}.`,
        whyItMatters: "Role modifications alter user access rights and confidential data permissions across the platform.",
        recommendedAction: "Verify that this permission elevation was authorized by system administration.",
      };
    }
    if (action.includes("DEACTIVAT")) {
      return {
        affectedModule: "User Accounts",
        contextSummary: "User account deactivated, immediately revoking access to the system.",
        whyItMatters: "Deactivated users cannot log in or manage active recruitment pipelines.",
        recommendedAction: "Reassign any pending candidate reviews or interviews to an active specialist.",
      };
    }
    return {
      affectedModule: "User Access & Personnel",
      contextSummary: `User management event '${formatAction(log.action)}' completed.`,
      whyItMatters: "Governs staff onboarding and system privileges.",
      recommendedAction: "No action required.",
    };
  }

  // 3. Recruitment & Applications
  if (category === "Recruitment") {
    if (action === "APPLICATION_STATUS_UPDATED") {
      const from = formatStage(details.fromStatus);
      const to = formatStage(details.toStatus);
      return {
        affectedModule: "Recruitment Pipeline",
        contextSummary: `Application moved from '${from}' to '${to}'.`,
        whyItMatters: "Stage advancements trigger candidate status updates and gate pre-employment workflows.",
        recommendedAction:
          to === "Compliance"
            ? "Ensure candidate uploads mandatory requirements documents before deployment."
            : to === "Hired"
            ? "Proceed with orientation scheduling and contract signing."
            : "Review candidate evaluation records before scheduling next steps.",
      };
    }
    return {
      affectedModule: "Recruitment Workflow",
      contextSummary: `Recruitment action '${formatAction(log.action)}' recorded.`,
      whyItMatters: "Ensures transparent and accountable hiring decisions.",
      recommendedAction: "Continue regular recruitment lifecycle.",
    };
  }

  // 4. Compliance
  if (category === "Compliance") {
    return {
      affectedModule: "Digital 201 & Compliance",
      contextSummary: `Compliance document event '${formatAction(log.action)}' recorded for ${details.documentLabel || "requirement"}.`,
      whyItMatters: "Compliance verification enforces legal and client requirements before site deployment.",
      recommendedAction:
        details.status === "REJECTED"
          ? "Notify candidate to re-upload clear or valid document copies."
          : "Verify all other mandatory checklist items are approved.",
    };
  }

  // 5. Deployment
  if (category === "Deployment") {
    return {
      affectedModule: "Client Deployments & Workforce",
      contextSummary: `Deployment record updated for '${details.clientName || "Client"}'.`,
      whyItMatters: "Directly affects client site fulfillment, active rosters, and billing periods.",
      recommendedAction: "Ensure site orientation and employment contract are signed.",
    };
  }

  // 6. Configuration & Maintenance
  if (category === "Configuration" || category === "Security") {
    if (action.includes("DATABASE_BACKUP")) {
      return {
        affectedModule: "Database Maintenance & Recovery",
        contextSummary: `Encrypted PostgreSQL snapshot routine completed (${details.filename || "snapshot"}).`,
        whyItMatters: "Guarantees system disaster recovery readiness and data integrity.",
        recommendedAction: "Retain snapshot according to compliance schedule.",
      };
    }
    return {
      affectedModule: "System Configuration",
      contextSummary: `Configuration change '${formatAction(log.action)}' activated.`,
      whyItMatters: "Modifies global scoring criteria or system configuration settings.",
      recommendedAction: "Inspect candidate scoring metrics to observe algorithm impact.",
    };
  }

  // Default fallback
  return {
    affectedModule: category,
    contextSummary: `${formatAction(log.action)} recorded for ${formatTargetEntity(log).label}.`,
    whyItMatters: "Recorded in the permanent tamper-evident security audit trail.",
    recommendedAction: "No action required unless unexpected.",
  };
}
