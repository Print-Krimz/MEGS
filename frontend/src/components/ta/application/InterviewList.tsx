import React, { useState } from "react";
import { Check, Clock, Lock, Plus, X } from "lucide-react";
import { Button } from "../../ui";
import { formatDateTime } from "../../../lib/utils";
import { interviewTypeLabel } from "../../../lib/labels";
import type { Application } from "../../../lib/types";

type Interview = NonNullable<Application["interviews"]>[number];

export interface InterviewListProps {
  interviews: Interview[];
  /** Offered here only when the stage bar does not already carry the same action. */
  scheduleOffer: { type: "INITIAL_SCREENING" | "FINAL_INTERVIEW"; label: string } | null;
  onSchedule: (type: "INITIAL_SCREENING" | "FINAL_INTERVIEW") => void;
  onRecordResult: (interview: Interview) => void;
  onMarkPassed: (interview: Interview) => void;
  isMarkingPassed?: boolean;
}

const ResultPill: React.FC<{ kind: "pass" | "fail" | "noshow" | "scheduled" }> = ({ kind }) => {
  if (kind === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
        <Check className="h-3 w-3" aria-hidden="true" /> Passed
      </span>
    );
  }
  if (kind === "fail") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-900">
        <X className="h-3 w-3" aria-hidden="true" /> Not passed
      </span>
    );
  }
  if (kind === "noshow") {
    return <span className="inline-flex rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-900">No show</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-line bg-navy-soft px-2.5 py-0.5 text-xs font-semibold text-navy">
      <Clock className="h-3 w-3" aria-hidden="true" /> Scheduled
    </span>
  );
};

export const InterviewList: React.FC<InterviewListProps> = ({ interviews, scheduleOffer, onSchedule, onRecordResult, onMarkPassed, isMarkingPassed }) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? interviews : interviews.slice(0, 2);

  return (
    <section id="eval-interviews" aria-labelledby="interviews-heading" className="space-y-4">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h3 id="interviews-heading" className="text-base font-semibold text-slate-900">
            Interviews ({interviews.length})
          </h3>
          <p className="text-sm text-slate-600">Evaluate outcomes and keep the recruiter feedback.</p>
        </div>
        <div className="flex items-center gap-2">
          {interviews.length > 2 && (
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              {expanded ? "Show recent 2" : `View all (${interviews.length})`}
            </Button>
          )}
          {scheduleOffer && (
            <Button variant="outline" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => onSchedule(scheduleOffer.type)}>
              {scheduleOffer.label}
            </Button>
          )}
        </div>
      </div>

      {interviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-sm text-slate-600">
          No interviews scheduled yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map((int) => {
            const isPending = !int.result || int.result === "PENDING" || int.result === "SCHEDULED";
            const isPassed = int.result === "PASS" || int.result === "PASSED";
            const isFailed = int.result === "FAIL" || int.result === "FAILED";
            const isNoShow = int.result === "NO_SHOW";

            return (
              <div key={int.id} className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{interviewTypeLabel(int.type)}</span>
                    <ResultPill kind={isPassed ? "pass" : isFailed ? "fail" : isNoShow ? "noshow" : "scheduled"} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    <span>
                      Scheduled: <span className="tabular-nums">{formatDateTime(int.scheduledAt || int.createdAt)}</span>
                    </span>
                  </div>
                  {int.conductedAt && (
                    <div className="text-sm text-slate-600">
                      Conducted: <span className="tabular-nums">{formatDateTime(int.conductedAt)}</span>
                    </div>
                  )}
                  {int.notes && (
                    <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-700">Evaluation &amp; interview notes</p>
                      <p className="border-l-2 border-slate-400 pl-2.5 text-sm leading-relaxed text-slate-900">{int.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">
                  {isPending && (
                    <Button variant="outline" size="sm" loading={isMarkingPassed} onClick={() => onMarkPassed(int)}>
                      Mark as Passed
                    </Button>
                  )}
                  {isPassed || isFailed || isNoShow ? (
                    <span
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      title="Finalized results are read-only. An administrator can correct them with a recorded reason."
                    >
                      <Lock className="h-3 w-3" aria-hidden="true" /> Result finalized
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => onRecordResult(int)}>
                      Record Result
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
