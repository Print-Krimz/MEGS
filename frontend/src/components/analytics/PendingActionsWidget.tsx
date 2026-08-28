import React from "react";
import { Link } from "@tanstack/react-router";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Button } from "../ui";
import { formatDate } from "../../lib/utils";
import type { TAPendingActionItem } from "../../lib/types/analytics.types";

interface PendingActionsWidgetProps {
  actions?: TAPendingActionItem[];
  title?: string;
  subtitle?: string;
}

export const PendingActionsWidget: React.FC<PendingActionsWidgetProps> = ({
  actions = [],
  title = "Workload Action Queue",
  subtitle = "High-priority recruitment tasks requiring immediate recruiter attention and resolution",
}) => {
  return (
    <div className="border border-slate-300 bg-white">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-teal-800" />
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="text-xs font-mono">
          <span className="font-bold text-slate-950">{actions.length}</span> pending tasks
        </div>
      </div>

      {/* Action Items List */}
      {actions.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center justify-center space-y-1.5">
          <CheckSquare className="w-6 h-6 text-emerald-600" />
          <div className="text-xs font-mono font-bold uppercase text-slate-800">
            All Recruiter Queues Up to Date
          </div>
          <p className="text-[11px] text-slate-500 font-sans">
            No pending interviews, client acceptances, or compliance reviews require immediate action.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {actions.map((action) => {
            const isHigh = action.urgency === "HIGH";

            return (
              <div
                key={action.id}
                className="p-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase border ${
                        isHigh
                          ? "bg-rose-50 text-rose-800 border-rose-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                      }`}
                    >
                      {action.urgency} PRIORITY
                    </span>
                    <span className="font-bold text-slate-950 text-xs font-sans">
                      {action.title}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600 font-mono">
                    <span className="text-slate-900 font-bold">{action.candidateName}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600 font-sans">{action.jobTitle}</span>
                    {action.agingDays !== undefined && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-amber-800 font-bold">{action.agingDays}d elapsed</span>
                      </>
                    )}
                    {action.deadline && (
                      <>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">Deadline: {formatDate(action.deadline)}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  <Link to={action.targetUrl}>
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                      Take Action
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
