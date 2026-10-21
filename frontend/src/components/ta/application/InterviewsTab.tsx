import React from "react";
import { CalendarPlus, ClipboardCheck, Handshake } from "lucide-react";
import { Button } from "../../ui";
import { Timeline, type TimelineItem } from "../../common";
import { formatDateTime, cn } from "../../../lib/utils";
import { plural } from "../../../lib/plural";
import { interviewTypeLabel } from "../../../lib/labels";
import { TA_COPY, TA_STATUS_TONE_CLASSES, type TAStatusTone } from "../../../lib/ta-copy";
import type { Application } from "../../../lib/types";
import { interviewState, isOpenInterview, orderInterviews, type InterviewState } from "./summary";

type Interview = NonNullable<Application["interviews"]>[number];
type InterviewKind = "INITIAL_SCREENING" | "FINAL_INTERVIEW";

export interface InterviewsTabProps {
  interviews: Interview[];
  /** Epoch ms. Passed in so overdue days are stable within one render. */
  now: number;
  /** Offered here only when the stage bar does not already carry the same action. */
  scheduleOffer: { type: InterviewKind; label: string } | null;
  onSchedule: (type: InterviewKind) => void;
  onRecordOutcome: (interview: Interview) => void;
  onReschedule: (interview: Interview) => void;
  /** The stage bar already shows Record outcome and Reschedule for the open interview. */
  heroActionsInBar?: boolean;
}

const STATE_TEXT: Record<InterviewState, { label: string; tone: TAStatusTone }> = {
  passed: { label: "Passed", tone: "success" },
  failed: { label: "Not passed", tone: "danger" },
  noshow: { label: "No show", tone: "warning" },
  scheduled: { label: "Scheduled", tone: "info" },
  awaiting: { label: "Needs outcome", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
};

const typeIcon = (type: string) => (type === "FINAL_INTERVIEW" ? Handshake : ClipboardCheck);

const statusFor = (interview: Interview, now: number) => {
  const { state, daysOverdue } = interviewState(interview, now);
  const base = STATE_TEXT[state];
  return { state, status: state === "overdue" ? { ...base, label: `${plural(daysOverdue, "day")} overdue` } : base };
};

const factsFor = (interview: Interview): TimelineItem["meta"] => [
  { label: "Scheduled", value: <span className="tabular-nums">{formatDateTime(interview.scheduledAt || interview.createdAt)}</span> },
  ...(interview.conductedAt ? [{ label: "Conducted", value: <span className="tabular-nums">{formatDateTime(interview.conductedAt)}</span> }] : []),
];

const notesBlock = (interview: Interview) =>
  interview.notes ? (
    <div>
      <p className="text-xs font-medium text-slate-600">Notes</p>
      <p className="mt-0.5 border-l-2 border-slate-400 pl-2.5 leading-relaxed text-slate-900">{interview.notes}</p>
    </div>
  ) : undefined;

/**
 * The interview rounds as a timeline: each round with its outcome, the one that waits on the recruiter
 * lifted above the list with its actions, and the next round as a dashed step at the end.
 */
export const InterviewsTab: React.FC<InterviewsTabProps> = ({ interviews, now, scheduleOffer, onSchedule, onRecordOutcome, onReschedule, heroActionsInBar = false }) => {
  const ordered = orderInterviews([...interviews]);
  const pending = ordered.filter(isOpenInterview);
  // One hero at a time: the earliest open interview. Others (rare) stay in the list with their own actions.
  const hero = pending[0] ?? null;

  const actionsFor = (interview: Interview) => (
    <>
      <Button variant="primary" size="sm" onClick={() => onRecordOutcome(interview)}>
        {TA_COPY.interviews.recordOutcome}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onReschedule(interview)}>
        Reschedule
      </Button>
    </>
  );

  const items: TimelineItem[] = ordered
    .filter((i) => i !== hero)
    .map((interview) => {
      const { status } = statusFor(interview, now);
      return {
        id: `interview-${interview.id}`,
        icon: typeIcon(interview.type),
        title: interviewTypeLabel(interview.type),
        status,
        meta: factsFor(interview),
        body: notesBlock(interview),
        action: isOpenInterview(interview) ? actionsFor(interview) : undefined,
      };
    });

  if (scheduleOffer) {
    items.push({
      id: "next-interview",
      icon: CalendarPlus,
      title: scheduleOffer.type === "FINAL_INTERVIEW" ? interviewTypeLabel("FINAL_INTERVIEW") : interviewTypeLabel("INITIAL_SCREENING"),
      status: { label: "Not scheduled", tone: "neutral" },
      variant: "next",
      action: (
        <Button variant="outline" size="sm" leftIcon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => onSchedule(scheduleOffer.type)}>
          {scheduleOffer.label}
        </Button>
      ),
    });
  }

  const heroState = hero ? statusFor(hero, now) : null;
  const HeroIcon = hero ? typeIcon(hero.type) : null;

  return (
    <section aria-label="Interviews" className="space-y-4">

      {hero && heroState && HeroIcon && (
        <div className="rounded-md border border-navy bg-navy-soft/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <HeroIcon className="h-4 w-4 text-navy" aria-hidden="true" />
              {interviewTypeLabel(hero.type)}
            </p>
            <span className={cn("inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold", TA_STATUS_TONE_CLASSES[heroState.status.tone])}>
              {heroState.status.label}
            </span>
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {factsFor(hero)?.map((fact) => (
              <div key={fact.label} className="flex gap-1.5">
                <dt className="text-slate-600">{fact.label}</dt>
                <dd className="text-slate-900">{fact.value}</dd>
              </div>
            ))}
          </dl>
          {hero.notes && <div className="mt-3 text-sm">{notesBlock(hero)}</div>}
          {heroActionsInBar ? (
            <p className="mt-3 text-sm text-slate-600">Record the outcome or reschedule from the bar above.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">{actionsFor(hero)}</div>
          )}
        </div>
      )}

      {items.length > 0 ? (
        <Timeline items={items} ariaLabel="Interview rounds" />
      ) : !hero ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">No interviews scheduled yet.</p>
      ) : null}
    </section>
  );
};
