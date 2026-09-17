import { Role } from "./types/enums";

/**
 * Display-only language for the administrator workspace.
 * API values stay in their existing enum form; this map keeps technical
 * contracts out of the interface users read.
 */
export const ADMIN_ROLE_LABELS: Record<string, string> = {
  [Role.ADMINISTRATOR]: "Administrator",
  [Role.TALENT_ACQUISITION]: "Recruiter",
  [Role.APPLICANT]: "Applicant",
};

export const ADMIN_ROLE_DESCRIPTIONS: Record<string, string> = {
  [Role.ADMINISTRATOR]: "Full access to administration settings",
  [Role.TALENT_ACQUISITION]: "Works with hiring requests and candidates",
  [Role.APPLICANT]: "Candidate access to the applicant portal",
};

export const ADMIN_PIPELINE_LABELS: Record<string, string> = {
  APPLICATIONS: "Submitted",
  APPLICATIONS_RECEIVED: "Submitted",
  SUBMITTED: "Submitted",
  INITIAL_SCREENING: "Initial review",
  CLIENT_ENDORSEMENT: "Client review",
  CLIENT_REVIEW: "Client review",
  FINAL_INTERVIEW: "Final interview",
  HIRED: "Requirements",
  COMPLIANCE: "Requirements",
  ONBOARDING: "Contract & orientation",
  CONTRACT_AND_ORIENTATION: "Contract & orientation",
  DEPLOYED: "Deployed",
  DEPLOYMENT: "Deployed",
  SITE_DEPLOYMENT: "Deployed",
  REJECTED: "Not selected",
  WITHDRAWN: "Withdrawn",
  TALENT_POOL: "Talent pool",
};

export const ADMIN_BACKUP_STATUS_LABELS: Record<string, string> = {
  SUCCESS: "Completed",
  FAILED: "Failed",
  IN_PROGRESS: "In progress",
  READY: "Ready",
};

export function formatAdminRole(role?: string | null): string {
  if (!role) return "System";
  return ADMIN_ROLE_LABELS[role] || role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAdminPipelineStage(stage?: string | null): string {
  if (!stage) return "Not set";
  return ADMIN_PIPELINE_LABELS[stage.toUpperCase()] || stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAdminBackupStatus(status?: string | null): string {
  if (!status) return "Ready";
  return ADMIN_BACKUP_STATUS_LABELS[status] || status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
