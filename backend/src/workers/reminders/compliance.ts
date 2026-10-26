import prisma from "../../utils/prisma.js";
import { notifyOwner } from "../../utils/notification.js";
import { JOB_OWNER_SELECT, jobOwnerTaId, type JobOwnerFields } from "../../services/ta/ownership.js";
import { safeLogError } from "../../security/errors.js";
import {
  addTally,
  dueMilestone,
  daysUntilDue,
  dueSince, dueWithin,
  formatDue,
  withinEmailCatchup,
  isOverdue,
  newResult,
  notifyApplicant,
  reminderKey,
  type MilestoneRule,
  type ReminderResult,
} from "./rules.js";

// Documents are chased while the application is in Requirements or Contract signing.
const COMPLIANCE_STAGES = ["COMPLIANCE", "CONTRACT_SIGNING"] as const;
// Closed applications never get reminders.
const CLOSED_STATUSES = ["REJECTED", "BACKOUT", "ARCHIVED"] as const;

const APPLICATION_SELECT = {
  id: true,
  userId: true,
  jobPosting: { select: JOB_OWNER_SELECT },
} as const;

interface RequirementRow {
  id: number;
  documentLabel: string;
  application: { id: number; userId: string; jobPosting: JobOwnerFields | null } | null;
}

interface SweepSpec {
  kind: string;
  rows: Array<RequirementRow & { due: Date }>;
  applicant: MilestoneRule;
  owner: MilestoneRule;
  /** Applicant milestones that also go by email. */
  emailFor: (milestone: string) => boolean;
  applicantText: (label: string, milestone: string, due: string) => string;
  ownerText: (label: string, milestone: string, due: string, applicationId: number) => string;
  title: string;
}

const runRows = async (spec: SweepSpec, now: Date): Promise<ReminderResult> => {
  const result = newResult();
  result.scannedCount = spec.rows.length;

  for (const row of spec.rows) {
    const application = row.application;
    if (!application) continue;
    try {
      const days = daysUntilDue(row.due, now);
      const dueText = formatDue(row.due);

      const forApplicant = dueMilestone(days, spec.applicant);
      if (forApplicant) {
        addTally(
          result,
          await notifyApplicant(
            application.userId,
            spec.title,
            spec.applicantText(row.documentLabel, forApplicant, dueText),
            isOverdue(forApplicant) ? "WARNING" : "INFO",
            `/app/applications/${application.id}`,
            {
              dedupeKey: reminderKey(spec.kind, row.id, row.due, forApplicant),
              sendEmail: spec.emailFor(forApplicant) && withinEmailCatchup(days),
              ctaText: "Open application",
            }
          )
        );
      }

      const forOwner = dueMilestone(days, spec.owner);
      if (forOwner) {
        addTally(
          result,
          await notifyOwner(
            application.jobPosting ? jobOwnerTaId(application.jobPosting) : null,
            spec.title,
            spec.ownerText(row.documentLabel, forOwner, dueText, application.id),
            "WARNING",
            `/ta/applications/${application.id}`,
            { dedupeKey: reminderKey(spec.kind, row.id, row.due, forOwner), sendEmail: false }
          )
        );
      }
    } catch (error) {
      result.failedCount++;
      safeLogError(`${spec.kind} reminder for requirement ${row.id}`, error);
    }
  }
  return result;
};

const when = (milestone: string, dueText: string): string =>
  milestone === "today" ? "is due today" : isOverdue(milestone) ? `was due on ${dueText} and is overdue` : `is due on ${dueText}`;

const SELECT = {
  id: true,
  documentLabel: true,
  deadline: true,
  updateRequestDeadline: true,
  toFollowExpectedAt: true,
  application: { select: APPLICATION_SELECT },
} as const;

/** Required requirement deadlines. Applicant: 2 days before, on the day, first overdue day. Owner TA: overdue, then weekly. */
export const sendComplianceDueReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.complianceRequirement.findMany({
    where: {
      isRequired: true,
      deadline: { not: null, gte: dueSince(now), lte: dueWithin(now, 2) },
      // SUBMITTED means the applicant already uploaded and the TA is reviewing it.
      reviewStatus: { notIn: ["APPROVED", "TO_FOLLOW", "SUBMITTED"] },
      // A requirement with an open update request is chased by doc-update-due instead.
      OR: [{ updateRequestDeadline: null }, { updateRequestCompletedAt: { not: null } }],
      application: { isArchived: false, status: { in: [...COMPLIANCE_STAGES] } },
    },
    select: SELECT,
  });

  return runRows(
    {
      kind: "compliance-due",
      rows: rows.flatMap((r) => (r.deadline ? [{ ...r, due: r.deadline }] : [])),
      applicant: { soonDays: 2, today: true, overdueEvery: Infinity },
      owner: { overdueEvery: 7 },
      emailFor: (m) => m === "soon" || isOverdue(m),
      title: "Document deadline",
      applicantText: (label, m, due) => `Your ${label} ${when(m, due)}. Please upload it.`,
      ownerText: (label, m, due, id) => `${label} ${when(m, due)} for application #${id}.`,
    },
    now
  );
};

/** Documents the TA asked the applicant to replace. Same milestones as compliance-due. */
export const sendDocUpdateDueReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.complianceRequirement.findMany({
    where: {
      updateRequestDeadline: { not: null, gte: dueSince(now), lte: dueWithin(now, 2) },
      updateRequestCompletedAt: null,
      // Once the new copy is uploaded (SUBMITTED) the TA is reviewing it; stop chasing the applicant.
      reviewStatus: { not: "SUBMITTED" },
      application: { isArchived: false, status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: SELECT,
  });

  return runRows(
    {
      kind: "doc-update-due",
      rows: rows.flatMap((r) => (r.updateRequestDeadline ? [{ ...r, due: r.updateRequestDeadline }] : [])),
      applicant: { soonDays: 2, today: true, overdueEvery: Infinity },
      owner: { overdueEvery: 7 },
      emailFor: (m) => m === "soon" || isOverdue(m),
      title: "Document update deadline",
      applicantText: (label, m, due) => `The new copy of your ${label} ${when(m, due)}. Please upload it.`,
      ownerText: (label, m, due, id) => `The new copy of ${label} ${when(m, due)} for application #${id}.`,
    },
    now
  );
};

/** Documents the applicant promised to bring later. Applicant on the day; owner TA when overdue, then weekly. */
export const sendToFollowDueReminders = async (now: Date = new Date()): Promise<ReminderResult> => {
  const rows = await prisma.complianceRequirement.findMany({
    where: {
      toFollowExpectedAt: { not: null, gte: dueSince(now), lte: dueWithin(now, 0) },
      reviewStatus: "TO_FOLLOW",
      application: { isArchived: false, status: { notIn: [...CLOSED_STATUSES] } },
    },
    select: SELECT,
  });

  return runRows(
    {
      kind: "to-follow-due",
      rows: rows.flatMap((r) => (r.toFollowExpectedAt ? [{ ...r, due: r.toFollowExpectedAt }] : [])),
      applicant: { today: true },
      owner: { overdueEvery: 7 },
      emailFor: () => true,
      title: "Document expected",
      applicantText: (label, _m, _due) => `Your ${label} is expected today. Please upload it.`,
      ownerText: (label, _m, due, id) => `${label} was expected on ${due} and is still missing for application #${id}.`,
    },
    now
  );
};
