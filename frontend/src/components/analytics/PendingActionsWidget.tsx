import React from "react";
import { Link } from "@tanstack/react-router";
import { CheckSquare, ArrowRight } from "lucide-react";
import { formatDate } from "../../lib/utils";
import type { TAPendingActionItem } from "../../lib/types/analytics.types";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { plural } from "../../lib/plural";

interface PendingActionsWidgetProps {
  actions?: TAPendingActionItem[];
  /** True number of pending items when the list is capped. */
  total?: number;
  title?: string;
  subtitle?: string;
  /** Content only, for use inside a tab. */
  bare?: boolean;
}

const URGENCY_LABEL: Record<TAPendingActionItem["urgency"], string> = {
  HIGH: "High priority",
  MEDIUM: "Medium priority",
  NORMAL: "Normal priority",
};

export const PendingActionsWidget: React.FC<PendingActionsWidgetProps> = ({
  actions = [],
  total,
  title = "Pending work",
  subtitle = "Interviews, client answers and document reviews waiting on you, oldest first.",
  bare = false,
}) => (
  <AnalyticsPanel
    title={title}
    subtitle={subtitle}
    bare={bare}
    aside={
      total !== undefined && total > actions.length ? (
        <span>
          Showing <span className="font-bold text-slate-950">{actions.length}</span> of{" "}
          <span className="font-bold text-slate-950">{total}</span> pending tasks
        </span>
      ) : (
        <span>
          <span className="font-bold text-slate-950">{actions.length}</span> {actions.length === 1 ? "pending task" : "pending tasks"}
        </span>
      )
    }
  >
    {bare && total !== undefined && total > actions.length && (
      <p className="border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-600 font-sans">
        Showing <span className="font-bold text-slate-950">{actions.length}</span> of <span className="font-bold text-slate-950">{total}</span> pending tasks, oldest first. Finish some to see the rest.
      </p>
    )}
    {actions.length === 0 ? (
      <div className="p-8 text-center flex flex-col items-center justify-center space-y-1.5">
        <CheckSquare className="w-6 h-6 text-slate-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-900">Nothing is waiting on you</p>
        <p className="text-xs text-slate-600 font-sans">No interviews, client answers or document reviews need action.</p>
      </div>
    ) : (
      <ul className="divide-y divide-slate-200">
        {actions.map((action) => {
          const isHigh = action.urgency === "HIGH";
          return (
            <li key={action.id} className="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-1.5 py-0.5 text-xs font-semibold border ${
                      isHigh ? "bg-rose-50 text-rose-800 border-rose-300" : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}
                  >
                    {URGENCY_LABEL[action.urgency]}
                  </span>
                  <span className="font-bold text-slate-950 text-xs font-sans">{action.title}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 font-sans">
                  <span className="text-slate-900 font-bold">{action.candidateName}</span>
                  <span className="text-slate-400" aria-hidden="true">•</span>
                  <span>{action.jobTitle}</span>
                  {action.agingDays !== undefined && (
                    <>
                      <span className="text-slate-400" aria-hidden="true">•</span>
                      <span className="text-amber-800 font-bold">{plural(action.agingDays, "day")} waiting</span>
                    </>
                  )}
                  {action.deadline && (
                    <>
                      <span className="text-slate-400" aria-hidden="true">•</span>
                      <span className="text-slate-600">Deadline {formatDate(action.deadline)}</span>
                    </>
                  )}
                </div>
              </div>
              <Link
                to={action.targetUrl}
                className="shrink-0 inline-flex min-h-11 md:min-h-9 items-center justify-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                Open
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    )}
  </AnalyticsPanel>
);
