import type { Application, RecruiterDecision } from "../../../lib/types";
import { CLOSURE_DISPOSITION_LABELS, CLOSURE_OUTCOME_LABELS, closureReasonLabel } from "../../../lib/backout";
import { applicationStatusLabel, humanizeEnum, interviewResultLabel, interviewTypeLabel, requirementStatusLabel } from "../../../lib/labels";

export type ActivityKind = "submitted" | "stage" | "interview" | "client" | "requirement" | "closure";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  /** Why it happened or what was noted. */
  detail?: string;
  /** Who did it. Email is the only identity the decision log carries. */
  actor?: { email?: string | null; role?: string | null };
}

const time = (value?: string | null) => (value ? Date.parse(value) : NaN);

const outcomeWord = (outcome?: string | null) =>
  outcome === "APPROVED" || outcome === "ENDORSED" ? "Approved" : outcome === "DECLINED" ? "Declined" : "Waiting for client";

/**
 * One timeline from data the record page already loaded: stage decisions, interviews, client decisions,
 * requirement reviews and the closure. No extra requests. Newest first.
 */
export function buildActivity(app: Application, decisions: RecruiterDecision[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  for (const d of decisions) {
    const skipped = d.transitionType === "SKIP" && d.skippedStages?.length ? `Skipped: ${d.skippedStages.map(applicationStatusLabel).join(", ")}. ` : "";
    events.push({
      id: `decision-${d.id}`,
      at: d.createdAt,
      kind: "stage",
      title: `${applicationStatusLabel(d.fromStatus)} → ${applicationStatusLabel(d.toStatus)}`,
      detail: `${skipped}${d.reason ?? ""}`.trim() || undefined,
      actor: { email: d.actor?.email ?? null, role: d.actor?.role ?? null },
    });
  }

  for (const i of app.interviews ?? []) {
    const type = interviewTypeLabel(i.type);
    events.push({
      id: `interview-${i.id}-scheduled`,
      at: i.createdAt,
      kind: "interview",
      title: `${type} scheduled`,
    });
    const result = i.result && i.result !== "PENDING" && i.result !== "SCHEDULED" ? i.result : null;
    if (result) {
      events.push({
        id: `interview-${i.id}-result`,
        at: i.conductedAt || i.updatedAt || i.createdAt,
        kind: "interview",
        title: `${type}: ${interviewResultLabel(result === "PASSED" ? "PASS" : result === "FAILED" ? "FAIL" : result)}`,
        detail: i.notes || undefined,
      });
    }
  }

  for (const e of app.clientEndorsements ?? []) {
    const client = e.client?.name || "the client";
    events.push({ id: `client-${e.id}-sent`, at: e.createdAt, kind: "client", title: `Sent to ${client}` });
    if (e.outcome !== "PENDING") {
      events.push({
        id: `client-${e.id}-decision`,
        at: e.updatedAt || e.createdAt,
        kind: "client",
        title: `${client}: ${outcomeWord(e.outcome)}`,
        detail: e.notes || undefined,
      });
    }
  }

  for (const r of app.complianceRequirements ?? []) {
    if (!r.reviewedAt) continue;
    events.push({
      id: `requirement-${r.id}`,
      at: r.reviewedAt,
      kind: "requirement",
      title: `${r.documentLabel}: ${requirementStatusLabel(r.reviewStatus)}`,
      detail: r.reviewNotes || undefined,
      actor: { email: r.reviewedBy?.email ?? null },
    });
  }

  const closure = (app.closures ?? [])[0];
  if (closure) {
    events.push({
      id: "closure",
      at: closure.occurredAt,
      kind: "closure",
      title: [
        CLOSURE_OUTCOME_LABELS[closure.outcome],
        closureReasonLabel(closure.reasonCode),
        closure.disposition ? CLOSURE_DISPOSITION_LABELS[closure.disposition] : null,
      ]
        .filter(Boolean)
        .join(" · "),
      detail: `At ${applicationStatusLabel(closure.stage)}.${closure.notes ? ` ${closure.notes}` : ""}`,
    });
  }

  if (app.createdAt) {
    events.push({ id: "submitted", at: app.createdAt, kind: "submitted", title: "Application submitted" });
  }

  return events
    .filter((e) => !Number.isNaN(time(e.at)))
    .sort((a, b) => time(b.at) - time(a.at));
}

/** "talent_acquisition" becomes "Talent acquisition". */
export const roleLabel = (role?: string | null): string => (role ? humanizeEnum(role) : "");
