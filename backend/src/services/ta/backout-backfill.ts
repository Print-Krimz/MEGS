// Turns old "withdrew / no-show" archive notes into structured backout records. Pure planning only;
// scripts/backfill-backouts.ts reads the decisions and writes the plan.
import { BACKOUT_ELIGIBLE_STATUSES } from "./backout-rules.js";

export const WITHDREW_PREFIX = "Candidate Withdrew / Backout";
export const NO_SHOW_PREFIX = "Interview NO_SHOW auto-archive";

export interface DecisionRow {
  id: number;
  applicationId: number;
  actorId: string;
  fromStatus: string;
  toStatus: string;
  reason: string | null;
  createdAt: Date;
  isReverted: boolean;
}

export interface PlannedBackout {
  applicationId: number;
  stage: string;
  party: "APPLICANT";
  reason: "NO_SHOW" | "OTHER";
  notes: string | null;
  occurredAt: Date;
  recordedById: string;
  decisionId: number;
}

export interface BackfillPlan {
  create: PlannedBackout[];
  skipped: { decisionId: number; why: string }[];
}

/**
 * Old data only ever recorded applicant withdrawals and no-shows, so the party is always the applicant.
 * The application status is left alone; analytics read the backout record, so history is not rewritten.
 */
export function planBackfill(decisions: DecisionRow[], alreadyRecorded: Set<number>): BackfillPlan {
  const skipped: BackfillPlan["skipped"] = [];
  const latest = new Map<number, PlannedBackout>();

  for (const d of decisions) {
    if (d.isReverted) {
      skipped.push({ decisionId: d.id, why: "reverted" });
      continue;
    }
    const reason = d.reason?.trim() ?? "";
    const isNoShow = reason.startsWith(NO_SHOW_PREFIX);
    const isWithdrew = reason.startsWith(WITHDREW_PREFIX);
    const isBackoutStatus = d.toStatus === "BACKOUT";
    if (!isNoShow && !isWithdrew && !isBackoutStatus) {
      skipped.push({ decisionId: d.id, why: "not a withdrawal or no-show" });
      continue;
    }
    if (alreadyRecorded.has(d.applicationId)) {
      skipped.push({ decisionId: d.id, why: "backout already recorded" });
      continue;
    }
    if (!(BACKOUT_ELIGIBLE_STATUSES as readonly string[]).includes(d.fromStatus)) {
      skipped.push({ decisionId: d.id, why: `cannot back out from ${d.fromStatus}` });
      continue;
    }

    const note = isWithdrew ? reason.slice(WITHDREW_PREFIX.length).replace(/^:\s*/, "") : isNoShow ? "Missed scheduled interview" : reason;
    const planned: PlannedBackout = {
      applicationId: d.applicationId,
      stage: d.fromStatus,
      party: "APPLICANT",
      reason: isNoShow ? "NO_SHOW" : "OTHER",
      notes: note || null,
      occurredAt: d.createdAt,
      recordedById: d.actorId,
      decisionId: d.id,
    };
    // One backout per application: keep the most recent decision.
    const current = latest.get(d.applicationId);
    if (!current || planned.occurredAt > current.occurredAt) {
      if (current) skipped.push({ decisionId: current.decisionId, why: "superseded by a later decision" });
      latest.set(d.applicationId, planned);
    } else {
      skipped.push({ decisionId: d.id, why: "superseded by a later decision" });
    }
  }

  return { create: [...latest.values()], skipped };
}
