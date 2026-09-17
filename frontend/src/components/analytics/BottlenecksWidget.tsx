import React from "react";
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import type { BottleneckItem } from "../../lib/types/analytics.types";
import { formatAdminPipelineStage } from "../../lib/admin-copy";

interface BottlenecksWidgetProps {
  bottlenecks?: BottleneckItem[];
  title?: string;
  subtitle?: string;
}

export const BottlenecksWidget: React.FC<BottlenecksWidgetProps> = ({
  bottlenecks = [],
  title = "Reviews that need attention",
  subtitle = "Hiring stages where candidates have waited longer than the target",
}) => {
  return (
    <div className="border border-slate-300 bg-white">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-700" />
          <div>
            <h3 className="text-xs font-semibold font-sans text-slate-900">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Bottlenecks Grid */}
      {bottlenecks.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          No delayed reviews found for this selection.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-300">
          {bottlenecks.map((item) => {
            const isCritical = item.severity === "CRITICAL";
            const isWarning = item.severity === "WARNING";

            return (
              <div key={item.stageKey} className="p-3.5 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-600 tracking-wider truncate">
                       {formatAdminPipelineStage(item.stageKey || item.stageLabel)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border ${
                        isCritical
                          ? "bg-rose-50 text-rose-800 border-rose-300"
                          : isWarning
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : "bg-emerald-50 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {isCritical ? (
                        <ShieldAlert className="w-2.5 h-2.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-2.5 h-2.5" />
                      ) : (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      )}
                      <span>{isCritical ? "Needs attention" : isWarning ? "Watch" : "On track"}</span>
                    </span>
                  </div>

                  <div className="text-2xl font-bold font-sans text-slate-950 tabular-nums">
                    {item.candidateCount}{" "}
                    <span className="text-xs font-normal text-slate-500 font-sans">candidates</span>
                  </div>

                  <p className="text-[11px] text-slate-500 font-sans leading-tight">
                    {item.description}
                  </p>
                </div>

                {/* Review SLA Metrics */}
                <div className="pt-2 border-t border-slate-200 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Average wait:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        item.averageAgingDays > item.slaThresholdDays ? "text-amber-800" : "text-slate-900"
                      }`}
                    >
                      {item.averageAgingDays} days
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Target wait:</span>
                    <span className="text-slate-700 font-medium">{item.slaThresholdDays} days</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Past-due reviews:</span>
                    <span
                      className={`font-bold tabular-nums ${
                        item.overdueCount > 0 ? "text-rose-700" : "text-slate-900"
                      }`}
                    >
                      {item.overdueCount} candidates
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
