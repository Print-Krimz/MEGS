import React from "react";
import { Filter, CheckCircle2 } from "lucide-react";
import type { FunnelAnalytics } from "../../lib/types/analytics.types";

interface RecruitmentFunnelProps {
  data?: FunnelAnalytics;
  title?: string;
  subtitle?: string;
}

export const RecruitmentFunnel: React.FC<RecruitmentFunnelProps> = ({
  data,
  title = "Hiring Funnel",
  subtitle = "Candidate progression through each hiring stage",
}) => {
  const stages = data?.stages || [];
  const total = data?.totalApplications || 0;

  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="border border-slate-300 bg-white">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-teal-800" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              {title}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 font-sans mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-[10px] text-slate-500 uppercase font-bold">Overall Yield</div>
          <div className="text-sm font-bold text-teal-950 tabular-nums">
            {stages.length > 0 ? stages[stages.length - 1].overallConversion : 0}%
          </div>
        </div>
      </div>

      {/* Funnel Rows */}
      {stages.length === 0 || total === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          No pipeline funnel data recorded for this selection.
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {stages.map((st, idx) => {
            const barWidthPercent = Math.max(4, Math.round((st.count / maxCount) * 100));
            const isFirst = idx === 0;
            const isLast = idx === stages.length - 1;

            return (
              <div key={st.stage} className="space-y-1">
                {/* Stage Info Header */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 bg-slate-900 text-white text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-950 uppercase">{st.label}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px]">
                    <div>
                      <span className="text-slate-500">Candidates: </span>
                      <span className="font-bold text-slate-950 tabular-nums">{st.count}</span>
                    </div>

                    {!isFirst && (
                      <div>
                        <span className="text-slate-500">Pass Rate: </span>
                        <span
                          className={`font-bold tabular-nums ${
                            st.conversionRate >= 70
                              ? "text-emerald-700"
                              : st.conversionRate >= 40
                              ? "text-amber-700"
                              : "text-rose-700"
                          }`}
                        >
                          {st.conversionRate}%
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="text-slate-500">Total Yield: </span>
                      <span className="font-bold text-teal-900 tabular-nums">{st.overallConversion}%</span>
                    </div>
                  </div>
                </div>

                {/* Funnel Bar */}
                <div className="h-6 bg-slate-100 border border-slate-300 relative overflow-hidden flex items-center">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isLast
                        ? "bg-emerald-600"
                        : idx === 0
                        ? "bg-slate-800"
                        : "bg-teal-700"
                    }`}
                    style={{ width: `${barWidthPercent}%` }}
                  />

                  <div className="absolute left-2.5 text-[10px] font-mono font-bold text-white drop-shadow-xs flex items-center gap-1">
                    {isLast && <CheckCircle2 className="w-3 h-3 text-emerald-300" />}
                    <span>{st.count} candidates</span>
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
