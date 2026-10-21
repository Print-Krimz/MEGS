import React from "react";
import { ArrowRightLeft, Building2, Calendar, FileCheck, Send, UserX } from "lucide-react";
import { formatDateTime } from "../../../lib/utils";
import { roleLabel, type ActivityEvent, type ActivityKind } from "./activity";

const ICONS: Record<ActivityKind, React.ElementType> = {
  submitted: Send,
  stage: ArrowRightLeft,
  interview: Calendar,
  client: Building2,
  requirement: FileCheck,
  closure: UserX,
};

const KIND_LABEL: Record<ActivityKind, string> = {
  submitted: "Application",
  stage: "Stage change",
  interview: "Interview",
  client: "Client review",
  requirement: "Requirement",
  closure: "Closure",
};

export interface ActivityTabProps {
  events: ActivityEvent[];
  /** The decision log is still loading. */
  isLoading?: boolean;
}

/** Everything that happened to this application, newest first. */
export const ActivityTab: React.FC<ActivityTabProps> = ({ events, isLoading }) => {
  const onlySubmission = events.length === 1 && events[0].kind === "submitted";

  return (
    <div className="space-y-5">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Activity</h3>
        <p className="text-sm text-slate-600">Stage changes, interviews, client decisions, requirement reviews and closures, newest first.</p>
      </div>

      {isLoading && events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600">Loading activity…</p>
      ) : (
        <>
          <ol className="relative space-y-4 before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-slate-200">
            {events.map((event) => {
              const Icon = ICONS[event.kind];
              return (
                <li key={event.id} className="relative flex items-start gap-4">
                  <div className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-navy-line bg-navy-soft text-navy">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <p className="font-semibold text-slate-900">
                        <span className="sr-only">{KIND_LABEL[event.kind]}: </span>
                        {event.title}
                      </p>
                      <time dateTime={event.at} className="font-mono text-xs tabular-nums text-slate-600">
                        {formatDateTime(event.at)}
                      </time>
                    </div>
                    {event.actor?.email && (
                      <p className="text-xs text-slate-600">
                        By <span className="font-medium text-slate-800">{event.actor.email}</span>
                        {event.actor.role ? ` · ${roleLabel(event.actor.role)}` : ""}
                      </p>
                    )}
                    {event.detail && <p className="text-slate-800">{event.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {onlySubmission && <p className="text-sm text-slate-600">No activity yet beyond the application submission.</p>}
        </>
      )}
    </div>
  );
};
