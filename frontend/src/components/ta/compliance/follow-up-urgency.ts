import { calculateUrgencyStatus, getFollowUpTargetDate } from "../../../lib/compliance-queue";
import { formatDate } from "../../../lib/utils";
import { plural } from "../../../lib/plural";

type FollowUpRequirement = Parameters<typeof getFollowUpTargetDate>[0] & { reviewStatus: string };

export interface FollowUpUrgency {
  tone: "overdue" | "upcoming" | "later" | "none";
  /** The one line that matters, e.g. "3 documents 5 days overdue". */
  text: string;
  /** Muted second line: the next target date still ahead, when there is one. */
  nextDue: string | null;
}

/** A single document's wording, for the review dialog's list: "5 days overdue", "Due in 4 days". */
export function followUpDocumentUrgency(req: FollowUpRequirement): string {
  const target = getFollowUpTargetDate(req);
  const urgency = calculateUrgencyStatus(target);
  if (urgency.category === "OVERDUE") return `${plural(Math.abs(urgency.diffDays ?? 0), "day")} overdue`;
  if (urgency.category === "UPCOMING") {
    const days = urgency.diffDays ?? 0;
    return days === 0 ? "Due today" : `Due in ${plural(days, "day")}`;
  }
  if (urgency.category === "HEALTHY" && target) return `Due ${formatDate(target)}`;
  return "No target date";
}

/**
 * One urgency line for a worker row. Looks only at open documents (not approved).
 * Overdue wins over due soon, and due soon wins over later, so the worst case always shows.
 */
export function summarizeFollowUpUrgency(requirements: FollowUpRequirement[]): FollowUpUrgency {
  const open = requirements.filter((r) => r.reviewStatus !== "APPROVED");
  const rows = open.map((r) => {
    const target = getFollowUpTargetDate(r);
    return { target, urgency: calculateUrgencyStatus(target) };
  });

  const overdue = rows.filter((r) => r.urgency.category === "OVERDUE");
  const upcoming = rows.filter((r) => r.urgency.category === "UPCOMING");
  const ahead = rows
    .filter((r) => r.target && r.urgency.diffDays !== null && r.urgency.diffDays >= 0)
    .sort((a, b) => (a.urgency.diffDays ?? 0) - (b.urgency.diffDays ?? 0));
  const nextDue = ahead[0]?.target ? formatDate(ahead[0].target) : null;

  if (overdue.length > 0) {
    const mostDays = Math.max(...overdue.map((r) => Math.abs(r.urgency.diffDays ?? 0)));
    return {
      tone: "overdue",
      text: `${plural(overdue.length, "document")} ${plural(mostDays, "day")} overdue`,
      nextDue,
    };
  }
  if (upcoming.length > 0) {
    return { tone: "upcoming", text: `${plural(upcoming.length, "document")} due within 7 days`, nextDue };
  }
  if (nextDue) return { tone: "later", text: `Next due ${nextDue}`, nextDue: null };
  return { tone: "none", text: "No target date", nextDue: null };
}
