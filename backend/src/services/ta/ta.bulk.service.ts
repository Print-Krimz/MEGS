import { DeploymentStatus } from "@prisma/client";
import { redactSensitiveText } from "../../security/errors.js";
import { assertOwns, type Actor } from "./ownership.js";
import { BackoutConflictError } from "./backout.service.js";
import { closeApplication } from "./closure.service.js";
import { archiveTAApplication, restoreTAApplication, updateTAApplicationStatus } from "./ta.applications.service.js";
import { updateInterviewResult } from "./ta.interviews.service.js";
import { dismissCheckIn } from "./walk-in-check-in.service.js";
import { WalkInConflictError } from "./walk-in.service.js";
import { cancelTalentPoolInvitation } from "./talent-pool-invitation.service.js";
import { InvalidKnnRequestError } from "../scoring/talent-pool-knn.service.js";
import { recordDeploymentReview, updateDeploymentStatus } from "./ta.deployments.service.js";
import { endEmployeeDeployment } from "../employee/employee.service.js";
import type { BulkMoveTarget } from "./bulk-rules.js";

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
  if (error instanceof BackoutConflictError || error instanceof WalkInConflictError || error instanceof InvalidKnnRequestError) return redactSensitiveText(error.message).slice(0, 200);
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

export const bulkMoveApplications = (ids: number[], status: BulkMoveTarget, actor: Actor) =>
  runBulk(ids, actor, (id) => updateTAApplicationStatus(id, status, actor.id));

export const bulkRejectApplications = (
  ids: number[],
  input: { reasonCode: string; disposition: "TALENT_POOL" | "ARCHIVE"; notes?: string },
  actor: Actor
) =>
  runBulk(ids, actor, (id) =>
    closeApplication({
      applicationId: id,
      outcome: "REJECTED",
      reasonCode: input.reasonCode,
      disposition: input.disposition,
      notes: input.notes,
      actorId: actor.id,
      actorRole: actor.role as "TALENT_ACQUISITION" | "ADMINISTRATOR",
    })
  );

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
  input: { result: "PASS" | "NO_SHOW"; notes?: string },
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

export const bulkRecordDeploymentCheckIns = (
  ids: number[],
  input: { nextReviewAt?: string | null; notes?: string | null },
  actor: Actor
) => runBulk(ids, actor, (id) => recordDeploymentReview(id, actor.id, input.nextReviewAt, input.notes), "deployment");

/**
 * Ends several active assignments with one date, reason and next step. A worker whose start date is after the
 * shared date fails on their own row, and the service refuses a deployment that is not active.
 */
export const bulkEndDeployments = (
  ids: number[],
  input: { actualEnd: string; reason: string; disposition: "AVAILABLE_FOR_REDEPLOYMENT" | "NOT_CONFIRMED" | "SEPARATED" },
  actor: Actor
) => runBulk(ids, actor, (id) => endEmployeeDeployment(id, actor.id, input), "deployment");
