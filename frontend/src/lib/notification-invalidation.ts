import type { Role } from "./types/enums";

export interface NotificationInvalidationEvidence {
  link?: string | null;
  type?: string | null;
  title?: string | null;
}

export type QueryKey = readonly unknown[];

const roleRoots: Record<Role, string> = {
  ADMINISTRATOR: "admin",
  TALENT_ACQUISITION: "ta",
  APPLICANT: "applicant",
};

const applicantApplicationEvents = new Set([
  "Application Received",
  "Application Update",
  "Interview Rescheduled",
  "Interview Scheduled",
  "Interview Update",
  "New Compliance Requirement",
  "Compliance Document Uploaded",
  "Pre-Employment Requirements Complete",
  "Pre-Employment Checklist Available",
  "Employment Contract Signed",
  "Orientation Completed",
  "Redeployment Fast-Tracked",
  "Deployment Update",
  "Contract Signing Scheduled",
  "Contract Signing Rescheduled",
  "Reschedule Approved",
  "Reschedule Declined",
  "Interview Reminder",
  "Contract Signing Reminder",
]);

const taApplicationEvents = new Set([
  "New Candidate Application",
  "Job Invitation Accepted",
  "Interview Rescheduled",
  "Interview Scheduled for Candidate",
  "Interview Result Recorded",
  "Client Endorsement Decision Recorded",
  "Compliance Document Uploaded",
  "Compliance Document Re-Submitted",
  "All Compliance Documents Submitted",
  "Candidate Matched by AI",
  "Candidate Matched",
  "Reschedule Requested",
]);

export function getNotificationInvalidationKeys(
  notification: NotificationInvalidationEvidence,
  role: Role,
): QueryKey[] {
  const keys: QueryKey[] = [["notifications"]];
  const path = getPath(notification.link);
  const title = notification.title ?? "";

  const applicantApplication = path?.match(/^\/app\/applications\/(\d+)\/?$/);
  if (role === "APPLICANT" && applicantApplication && applicantApplicationEvents.has(title)) {
    const applicationId = applicantApplication[1];
    const related: QueryKey[] = [
      ["applicant", "my-applications"],
      ["applicant", "application", applicationId],
    ];
    if (title === "Application Received") related.push(["applicant", "invitations"]);
    if (title === "Application Update" || title === "Deployment Update") {
      related.push(["applicant", "active-deployment"]);
    }
    return [...keys, ...related];
  }

  const taApplication = path?.match(/^\/ta\/applications\/(\d+)\/?$/);
  if (role === "TALENT_ACQUISITION" && taApplication && taApplicationEvents.has(title)) {
    const applicationId = taApplication[1];
    const related: QueryKey[] = [
      ["ta", "applications"],
      ["ta", "application", applicationId],
      ["ta", "analytics"],
    ];
    if (["New Candidate Application", "Job Invitation Accepted", "Candidate Matched by AI", "Candidate Matched"].includes(title)) {
      related.push(["ta", "jobs"]);
      related.push(["ta", "job"]);
    }
    if (title === "Job Invitation Accepted") {
      related.push(["ta", "talent-pool", "invitations"]);
    }
    if (title.startsWith("Interview ") || title === "Interview Result Recorded") {
      related.push(["ta", "compliance", "interviews"]);
    }
    if (title.startsWith("Compliance ") || title === "All Compliance Documents Submitted") {
      related.push(["ta", "compliance"]);
    }
    return [...keys, ...related];
  }

  const taJobTalentPool = path?.match(/^\/ta\/jobs\/(\d+)\/?$/);
  if (role === "TALENT_ACQUISITION" && taJobTalentPool && title === "Talent Pool Candidates Matched" && hasTalentPoolTab(notification.link)) {
    return [...keys, ["ta", "job", taJobTalentPool[1], "talent-pool"]];
  }

  const taJob = path?.match(/^\/ta\/jobs\/(\d+)\/?$/);
  if (role === "TALENT_ACQUISITION" && taJob && title === "Job Invitation Declined") {
    return [...keys, ["ta", "job", taJob[1]], ["ta", "talent-pool", "invitations"]];
  }

  if (role === "APPLICANT" && path === "/app/invitations" && title === "Job Invitation Received") {
    return [...keys, ["applicant", "invitations"]];
  }

  const taMrf = path?.match(/^\/ta\/mrfs\/(\d+)\/?$/);
  if (role === "TALENT_ACQUISITION" && taMrf && ["MRF Quota Fulfilled", "MRF Quota Reopened"].includes(title)) {
    return [...keys, ["ta", "mrf", taMrf[1]], ["ta", "mrfs"], ["ta", "jobs"]];
  }

  return [...keys, [roleRoots[role]]];
}

function getPath(link?: string | null): string | undefined {
  if (!link || !link.startsWith("/")) return undefined;
  try {
    return new URL(link, "https://megs.local").pathname;
  } catch {
    return undefined;
  }
}

function hasTalentPoolTab(link?: string | null): boolean {
  if (!link) return false;
  try {
    return new URL(link, "https://megs.local").searchParams.get("tab") === "talentPool";
  } catch {
    return false;
  }
}
