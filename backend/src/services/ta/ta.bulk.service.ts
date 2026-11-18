import { DeploymentStatus } from "@prisma/client";
import prisma from "../../utils/prisma.js";
import { COMPANY_ADDRESS } from "../../config/business-hours.js";
import { redactSensitiveText } from "../../security/errors.js";
import { assertOwns, type Actor } from "./ownership.js";
import { BackoutConflictError } from "./backout.service.js";
import { closeApplication } from "./closure.service.js";
import { archiveTAApplication, confirmContractSigned, restoreTAApplication, scheduleContractSigning, updateTAApplicationStatus } from "./ta.applications.service.js";
import { getLatestClientEndorsement, recordClientEndorsement, updateClientEndorsement } from "./ta.endorsement.service.js";
import { ClientReviewNotRequiredError } from "./pipeline-rules.js";
import { scheduleNewInterview, updateInterviewResult, type InterviewMeetingMode } from "./ta.interviews.service.js";
import { dismissCheckIn } from "./walk-in-check-in.service.js";
import { WalkInConflictError } from "./walk-in.service.js";
import { cancelTalentPoolInvitation } from "./talent-pool-invitation.service.js";
import { InvalidKnnRequestError } from "../scoring/talent-pool-knn.service.js";
import { DeploymentConflictError, updateDeploymentStatus } from "./ta.deployments.service.js";
import { endEmployeeDeployment } from "../employee/employee.service.js";

export interface BulkRowResult {
  id: number;
  ok: boolean;
  reason?: string;
}

export interface BulkSummary {
  succeeded: number;
  failed: number;
  results: BulkRowResult[];
}

const GENERIC_REASON = "Could not process this record. Open it and try again.";

/**
 * Per-row reason shown to the recruiter. Business rules throw plain Errors with readable messages, so those pass
 * through (redacted). Anything else (database, network, programming errors) becomes a generic line.
 */
export const bulkReason = (error: unknown): string => {
  if (
    error instanceof BackoutConflictError ||
    error instanceof DeploymentConflictError ||
    error instanceof WalkInConflictError ||
    error instanceof InvalidKnnRequestError ||
    error instanceof ClientReviewNotRequiredError
  ) {
    return redactSensitiveText(error.message).slice(0, 200);
  }
  if (error instanceof Error && error.constructor === Error && error.message) {
    return redactSensitiveText(error.message).slice(0, 200);
  }
  return GENERIC_REASON;
};

/** A row that went through but needs a second look (for example, a no-show whose backout could not be recorded). */
interface RowOutcome {
  warning?: string;
}

/**
 * Runs `handle` for each id, one after another. A failing row never stops the rest: there is no cross-row
 * transaction. Duplicate ids run once.
 */
const settle = async (ids: number[], handle: (id: number) => Promise<RowOutcome | void>): Promise<BulkSummary> => {
  const results: BulkRowResult[] = [];
  for (const id of new Set(ids)) {
    try {
      const outcome = await handle(id);
      results.push(outcome?.warning ? { id, ok: true, reason: outcome.warning } : { id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, reason: bulkReason(error) });
    }
  }
  const succeeded = results.filter((row) => row.ok).length;
  return { succeeded, failed: results.length - succeeded, results };
};

/** Ownership is checked for every id, so a TA cannot reach a record outside their own requisitions. */
export const runBulk = (
  ids: number[],
  actor: Actor,
  handle: (id: number) => Promise<unknown>,
  kind: Parameters<typeof assertOwns>[0] = "application"
): Promise<BulkSummary> =>
  settle(ids, async (id) => {
    await assertOwns(kind, id, actor);
    await handle(id);
  });

export const bulkRejectApplications = (
  ids: number[],
  input: { reasonCode: string; disposition: "TALENT_POOL" | "ARCHIVE"; notes?: string },
  actor: Actor
) =>
  runBulk(ids, actor, async (id) => {
    // The application page does not offer Reject for a deployed worker, and rejecting one would leave the deployment
    // running. Backing out or ending the assignment are the right routes, so bulk refuses them too.
    const current = await prisma.application.findUnique({ where: { id }, select: { status: true } });
    if (current?.status === "DEPLOYED") {
      throw new Error("A deployed worker cannot be rejected. End the assignment or record a backout instead.");
    }
    return closeApplication({
      applicationId: id,
      outcome: "REJECTED",
      reasonCode: input.reasonCode,
      disposition: input.disposition,
      notes: input.notes,
      actorId: actor.id,
      actorRole: actor.role as "TALENT_ACQUISITION" | "ADMINISTRATOR",
    });
  });

export const bulkArchiveApplications = (ids: number[], reason: string, actor: Actor) =>
  runBulk(ids, actor, (id) => archiveTAApplication(id, actor.id, reason));

export const bulkRestoreApplications = (ids: number[], reason: string, actor: Actor) =>
  runBulk(ids, actor, (id) => restoreTAApplication(id, actor.id, reason));

/**
 * Records one result for many interviews. The row id is the interview id. The application and the interview must
 * both belong to the TA, and the pair must match (the service looks the interview up by both ids).
 */
export const bulkRecordInterviews = (
  items: { applicationId: number; interviewId: number }[],
  input: { result: "PASS" | "NO_SHOW"; notes?: string; autoAdvance?: boolean },
  actor: Actor
) => {
  const applicationOf = new Map(items.map((item) => [item.interviewId, item.applicationId]));
  return settle([...applicationOf.keys()], async (interviewId) => {
    const applicationId = applicationOf.get(interviewId)!;
    await assertOwns("application", applicationId, actor);
    await assertOwns("interview", interviewId, actor);
    const { applicationUpdateMessage } = await updateInterviewResult(
      applicationId,
      interviewId,
      input.result,
      new Date().toISOString(),
      input.notes,
      actor.id
    );
    // A no-show is saved even when the backout step fails, so the row is done but needs a look.
    if (applicationUpdateMessage.includes("Could not record the backout")) {
      return { warning: "Marked as no show, but the application was not closed. Open it to close it." };
    }
    if (input.result === "PASS" && input.autoAdvance) {
      try {
        const [interview, app] = await Promise.all([
          prisma.interview.findUnique({ where: { id: interviewId }, select: { type: true } }),
          prisma.application.findUnique({
            where: { id: applicationId },
            select: { status: true, jobPosting: { select: { mrf: { select: { requiresClientReview: true } } } } },
          }),
        ]);
        const type = interview?.type;
        const status = app?.status;
        const requiresClientReview = app?.jobPosting?.mrf?.requiresClientReview;

        if (type === "FINAL_INTERVIEW" && status === "FINAL_INTERVIEW") {
          await updateTAApplicationStatus(applicationId, "COMPLIANCE", actor.id, "Final interview passed.");
        } else if (type === "INITIAL_SCREENING") {
          if (requiresClientReview === false && status === "INITIAL_SCREENING") {
            await updateTAApplicationStatus(
              applicationId,
              "FINAL_INTERVIEW",
              actor.id,
              "Initial screening passed (client review not required)."
            );
          } else if (requiresClientReview !== false && status === "INITIAL_SCREENING") {
            await recordClientEndorsement(
              applicationId,
              undefined,
              "PENDING",
              actor.id,
              input.notes || "Passed initial screening."
            );
          }
        }
      } catch (err) {
        // Interview result already saved; surface follow-up transition errors as a row warning.
        return { warning: bulkReason(err) };
      }
    }
  });
};

/** Pending self check-ins are shared on purpose, so any TA at the desk may dismiss them. No ownership check. */
export const bulkDismissCheckIns = (ids: number[], reason: string, actor: Actor) =>
  settle(ids, async (id) => {
    await dismissCheckIn(actor, id, reason);
  });

/** The service lets only the TA who sent an invitation cancel it, the same rule as the single cancel. */
export const bulkCancelInvitations = (ids: number[], actor: Actor) =>
  settle(ids, async (id) => {
    await cancelTalentPoolInvitation(id, actor.id);
  });

/** Each deployment carries its own first working date, so a worker's contract start is not overwritten. */
export const bulkConfirmDeploymentStart = (
  items: { id: number; actualStart: string }[],
  notes: string | undefined,
  actor: Actor
) => {
  const startOf = new Map(items.map((item) => [item.id, item.actualStart]));
  return runBulk(
    [...startOf.keys()],
    actor,
    (id) => updateDeploymentStatus(id, DeploymentStatus.ACTIVE, notes, actor.id, startOf.get(id)),
    "deployment"
  );
};

/**
 * Ends several active assignments with one date, reason and next step. A worker whose start date is after the
 * shared date fails on their own row, and the service refuses a deployment that is not active.
 */
export const bulkEndDeployments = (
  ids: number[],
  input: { actualEnd: string; reason: string; disposition: "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "BACKED_OUT" | "SEPARATED" },
  actor: Actor
) => runBulk(ids, actor, (id) => endEmployeeDeployment(id, actor.id, input), "deployment");

/** Schedules one interview or contract-signing slot/location for many applications, each with its own slot. */
export const bulkScheduleInterviews = (
  items: { applicationId: number; scheduledAt: string }[],
  input: { type: "INITIAL_SCREENING" | "FINAL_INTERVIEW" | "CONTRACT_SIGNING"; location?: string; meetingMode?: InterviewMeetingMode },
  actor: Actor
) => {
  const scheduledAtOf = new Map(items.map((item) => [item.applicationId, item.scheduledAt]));
  return settle([...scheduledAtOf.keys()], async (applicationId) => {
    await assertOwns("application", applicationId, actor);
    const scheduledAt = scheduledAtOf.get(applicationId)!;
    if (input.type === "CONTRACT_SIGNING") {
      await scheduleContractSigning(applicationId, scheduledAt, input.location?.trim() || COMPANY_ADDRESS, actor.id);
      return;
    }
    if (input.meetingMode) {
      await scheduleNewInterview(applicationId, input.type, scheduledAt, input.location, actor.id, {
        meetingMode: input.meetingMode,
      });
      return;
    }
    await scheduleNewInterview(applicationId, input.type, scheduledAt, input.location, actor.id);
  });
};

const ENDORSEMENT_FALLBACK_NOTE = "Candidate passed initial screening and is endorsed for client review.";

const composeEndorsementNote = async (applicationId: number, explicitNotes?: string): Promise<string> => {
  const trimmed = explicitNotes?.trim();
  if (trimmed) return trimmed;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      aiScore: true,
      candidateScores: {
        where: { status: { in: ["CALCULATED", "STALE"] } },
        orderBy: { calculatedAt: "desc" },
        take: 1,
        select: { finalFitScore: true },
      },
      user: {
        select: {
          applicantProfile: {
            select: {
              skills: {
                take: 4,
                select: { skill: { select: { name: true } } },
              },
            },
          },
        },
      },
      interviews: {
        where: { type: "INITIAL_SCREENING", result: { in: ["PASS", "PASSED"] }, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { notes: true },
      },
    },
  });

  const rawScore = app?.candidateScores?.[0]?.finalFitScore ?? app?.aiScore;
  const score = rawScore !== null && rawScore !== undefined ? Number(rawScore) : null;
  const skills = (app?.user?.applicantProfile?.skills ?? [])
    .map((entry) => entry.skill?.name?.trim())
    .filter((name): name is string => Boolean(name))
    .slice(0, 4);
  const screeningNotes = app?.interviews?.[0]?.notes?.trim();

  const parts: string[] = [];
  if (score !== null && Number.isFinite(score)) {
    const formatted = Number.isInteger(score) ? String(score) : score.toFixed(1);
    parts.push(`Fit score: ${formatted}%.`);
  }
  if (skills.length > 0) {
    parts.push(`Skills: ${skills.join(", ")}.`);
  }
  if (screeningNotes) {
    parts.push(`Screening: ${screeningNotes}`);
  }
  return parts.length > 0 ? parts.join(" ").slice(0, 2000) : ENDORSEMENT_FALLBACK_NOTE;
};

/** Endorses selected applications to the client, composing a brief pitch from score, skills, and screening notes when no note is provided. */
export const bulkEndorseApplications = (
  ids: number[],
  input: { clientId?: number; notes?: string },
  actor: Actor
) =>
  runBulk(ids, actor, async (id) => {
    const note = await composeEndorsementNote(id, input.notes);
    return recordClientEndorsement(id, input.clientId, "PENDING", actor.id, note);
  });

/** Records a shared client endorsement decision across selected applications, updating the latest endorsement if one exists. */
export const bulkRecordClientDecision = (
  ids: number[],
  input: { outcome: "APPROVED" | "DECLINED"; notes: string },
  actor: Actor
) =>
  runBulk(ids, actor, async (id) => {
    const latest = await getLatestClientEndorsement(id);
    if (latest) {
      return updateClientEndorsement(id, latest.id, input.outcome, actor.id, input.notes);
    }
    return recordClientEndorsement(id, undefined, input.outcome, actor.id, input.notes);
  });

/** Advances compliant applications from Compliance to Contract Signing. */
export const bulkAdvanceToContractSigning = (ids: number[], actor: Actor) =>
  runBulk(ids, actor, (id) =>
    updateTAApplicationStatus(id, "CONTRACT_SIGNING", actor.id, "All mandatory pre-employment requirements approved.")
  );

/** Confirms that contracts were signed for selected applications with a scheduled contract signing. */
export const bulkConfirmContractSigned = (ids: number[], actor: Actor) =>
  runBulk(ids, actor, (id) => confirmContractSigned(id, actor.id));
