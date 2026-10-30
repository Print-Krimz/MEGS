import type {
  RedeploymentJobSuggestion,
  RedeploymentQueuePageResponse,
  RedeploymentStage,
} from "../../../lib/api/employees.api";
import type { TAStatusTone } from "../../../lib/ta-copy";
import { plural } from "../../../lib/plural";
import { scoreBand, type ScoreBand } from "../../common/ScoreBadge";

export type RedeploymentRow = RedeploymentQueuePageResponse["items"][number];

export const REDEPLOYMENT_STAGES: Array<{ id: RedeploymentStage; label: string; hint: string }> = [
  { id: "NEEDS_PLACEMENT", label: "Needs placement", hint: "No application or invitation yet" },
  { id: "WAITING_FOR_REPLY", label: "Waiting for reply", hint: "Invited, worker has not answered" },
  { id: "IN_PROGRESS", label: "Already applying", hint: "In a hiring pipeline" },
];

export const STAGE_TONE: Record<RedeploymentStage, TAStatusTone> = {
  NEEDS_PLACEMENT: "warning",
  WAITING_FOR_REPLY: "info",
  IN_PROGRESS: "neutral",
};

export const WARN_WAIT_DAYS = 7;
export const LONG_WAIT_DAYS = 14;

export const daysSince = (value: string | null) =>
  value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)) : null;

/** Waiting time as the age line under the stage chip. */
export const waitingAge = (since: string | null): { text: string; tone: "normal" | "urgent" | "warning" } => {
  const days = daysSince(since);
  if (days === null) return { text: "Waiting time not recorded", tone: "normal" };
  const text = days === 0 ? "Waiting since today" : `Waiting ${plural(days, "day")}`;
  return { text, tone: days >= LONG_WAIT_DAYS ? "urgent" : days >= WARN_WAIT_DAYS ? "warning" : "normal" };
};

export const suggestionTag = (suggestion: RedeploymentJobSuggestion) =>
  suggestion.sameClient
    ? "Same client"
    : suggestion.matchPercent !== null
      ? `${suggestion.matchPercent}% match`
      : "Related experience";

/** Colour classes for a "% match" tag by band; neutral when the suggestion has no percentage or is a same-client tag. */
export const matchTagClass = (suggestion: RedeploymentJobSuggestion, threshold: number) => {
  const band: ScoreBand | null =
    suggestion.sameClient || suggestion.matchPercent === null ? null : scoreBand(suggestion.matchPercent, threshold);
  return band === "high"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : band === "near"
      ? "border-yellow-300 bg-yellow-50 text-yellow-800"
      : band === "low"
        ? "border-rose-300 bg-rose-50 text-rose-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
};

export const suggestionReason = (suggestion: RedeploymentJobSuggestion) => {
  if (suggestion.sameClient) return "Same client, skips screening";
  const shared = suggestion.sharedKeywords?.length ? `shares ${suggestion.sharedKeywords.join(", ")}` : "";
  if (suggestion.matchPercent !== null) {
    return shared ? `${suggestion.matchPercent}% profile match, ${shared}` : `${suggestion.matchPercent}% profile match`;
  }
  return shared ? `Matches previous role or skills: ${shared}` : "Matches previous role or skills";
};

