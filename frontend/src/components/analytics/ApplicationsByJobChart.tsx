import React from "react";
import { Briefcase, Building2 } from "lucide-react";
import type { JobDemandItem } from "../../lib/types/analytics.types";

interface ApplicationsByJobChartProps {
  data?: JobDemandItem[];
  title?: string;
  subtitle?: string;
}

export const ApplicationsByJobChart: React.FC<ApplicationsByJobChartProps> = ({
  data = [],
  title = "Applications by Job Posting & MRF Demand",
  subtitle = "Recruitment intake volume, active pipeline density, and target headcount per client requisition",
}) => {
  const maxApplications = Math.max(1, ...data.map((j) => j.totalApplications));

  return (
    <div className="border border-slate-300 bg-white">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-300 bg-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-teal-800" />
          <div>
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">{subtitle}</p>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-500">
          <span className="font-bold text-slate-900">{data.length}</span> active postings
        </div>
      </div>

      {/* Content */}
      {data.length === 0 ? (
        <div className="p-8 text-center text-xs font-mono text-slate-400">
          No job postings or manpower requests recorded for this selection.
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {data.slice(0, 8).map((job) => {
            const barWidthPercent = Math.max(3, Math.round((job.totalApplications / maxApplications) * 100));

            return (
              <div key={job.jobId} className="p-3.5 hover:bg-slate-50 transition-colors space-y-2">
                {/* Title & Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-950 font-sans text-xs">{job.jobTitle}</span>
                    <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.2 bg-slate-100 border border-slate-300 uppercase">
                      {job.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{job.clientName || "Direct Job"}</span>
                    </div>
                    {job.mrfTitle && (
                      <span className="text-slate-400 truncate max-w-[150px]">
                        ({job.mrfTitle})
                      </span>
                    )}
                  </div>
                </div>

                {/* Bar & Counts */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-5 bg-slate-100 border border-slate-300 relative overflow-hidden flex items-center">
                    <div
                      className="h-full bg-teal-700 transition-all duration-300"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                    <span className="absolute left-2 text-[10px] font-mono font-bold text-white drop-shadow-xs">
                      {job.totalApplications} applications
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono shrink-0">
                    <div>
                      <span className="text-slate-400">Active: </span>
                      <span className="font-bold text-slate-900 tabular-nums">{job.activeCandidates}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Target: </span>
                      <span className="font-bold text-slate-900 tabular-nums">{job.targetHeadcount}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Deployed: </span>
                      <span className="font-bold text-emerald-800 tabular-nums">{job.deployedCount}</span>
                    </div>
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
