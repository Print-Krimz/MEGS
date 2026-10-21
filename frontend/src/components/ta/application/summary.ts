import type { Application, RecruiterDecision } from "../../../lib/types";
import { formatDateTime } from "../../../lib/utils";
import { interviewResultLabel } from "../../../lib/labels";

type Interview = NonNullable<Application["interviews"]>[number];

const DAY_MS = 24 * 60 * 60 * 1000;
/** Same 7-day window the schedule dialog promises: the result is due a week after the interview is booked. */
const RESULT_WINDOW_DAYS = 7;

export const isPassedResult = (result?: string | null) => result === "PASS" || result === "PASSED";
export const isFailedResult = (result?: string | null) => result === "FAIL" || result === "FAILED";
export const isOpenResult = (result?: string | null) => !result || result === "PENDING" || result === "SCHEDULED";

/** An interview that still waits for its outcome. A rescheduled (inactive) one no longer counts. */
export const isOpenInterview = (i: Interview) => i.isActive !== false && isOpenResult(i.result);

export type InterviewState = "scheduled" | "awaiting" | "overdue" | "passed" | "failed" | "noshow";

const time = (value?: string | null) => (value ? Date.parse(value) : NaN);

/** When the recruiter has to record the outcome by. */
const resultDeadline = (i: Interview): number => {
  const explicit = time(i.complianceDeadline);
  if (!Number.isNaN(explicit)) return explicit;
  const scheduled = time(i.scheduledAt);
  return Number.isNaN(scheduled) ? NaN : scheduled + RESULT_WINDOW_DAYS * DAY_MS;
};

/**
 * scheduled: in the future. awaiting: the time has passed and no outcome is recorded yet.
 * overdue: awaiting and past the 7-day window. The other states are recorded outcomes.
 */
export const interviewState = (i: Interview, now: number): { state: InterviewState; daysOverdue: number } => {
  if (isPassedResult(i.result)) return { state: "passed", daysOverdue: 0 };
  if (isFailedResult(i.result)) return { state: "failed", daysOverdue: 0 };
  if (i.result === "NO_SHOW") return { state: "noshow", daysOverdue: 0 };
  const deadline = resultDeadline(i);
  if (!Number.isNaN(deadline) && now > deadline) return { state: "overdue", daysOverdue: Math.max(1, Math.floor((now - deadline) / DAY_MS)) };
  const scheduled = time(i.scheduledAt);
  if (!Number.isNaN(scheduled) && now >= scheduled) return { state: "awaiting", daysOverdue: 0 };
  return { state: "scheduled", daysOverdue: 0 };
};

export const overdueInterviewCount = (interviews: Interview[], now: number): number =>
  interviews.filter((i) => isOpenInterview(i) && interviewState(i, now).state === "overdue").length;

/** Initial screening before final interview, then by date. Interviews that were rescheduled away are left out unless they have a result. */
export const orderInterviews = (interviews: Interview[]): Interview[] =>
  interviews
    .filter((i) => i.isActive !== false || !isOpenResult(i.result))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "INITIAL_SCREENING" ? -1 : 1;
      return (time(a.scheduledAt || a.createdAt) || 0) - (time(b.scheduledAt || b.createdAt) || 0);
    });

const shortType = (type: string) => (type === "FINAL_INTERVIEW" ? "Final interview" : "Screening");

/** One line for the summary strip: the interview that waits, else the last recorded result. */
export const summarizeInterview = (interviews: Interview[], now: number): string => {
  const open = interviews.filter(isOpenInterview).sort((a, b) => (time(a.scheduledAt) || 0) - (time(b.scheduledAt) || 0))[0];
  if (open) {
    const when = open.scheduledAt ? formatDateTime(open.scheduledAt) : "date not set";
    const { state } = interviewState(open, now);
    const suffix = state === "overdue" ? " (result overdue)" : state === "awaiting" ? " (needs result)" : "";
    return `${shortType(open.type)}, ${when}${suffix}`;
  }
  const done = interviews
    .filter((i) => !isOpenResult(i.result))
    .sort((a, b) => (time(b.conductedAt || b.updatedAt) || 0) - (time(a.conductedAt || a.updatedAt) || 0))[0];
  if (done) return `${shortType(done.type)} ${interviewResultLabel(isPassedResult(done.result) ? "PASS" : isFailedResult(done.result) ? "FAIL" : done.result).toLowerCase()}`;
  return "None yet";
};

/** Whole days since the application entered its current stage. The decision log is exact; without it the last update stands in. */
export const daysInStage = (
  app: Pick<Application, "status" | "createdAt" | "updatedAt">,
  decisions: Pick<RecruiterDecision, "toStatus" | "createdAt">[],
  now: number,
): number => {
  const entered = decisions
    .filter((d) => d.toStatus === app.status)
    .map((d) => time(d.createdAt))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const updated = time(app.updatedAt);
  const since = entered ?? (Number.isNaN(updated) ? time(app.createdAt) : updated);
  if (Number.isNaN(since)) return 0;
  return Math.max(0, Math.floor((now - since) / DAY_MS));
};
