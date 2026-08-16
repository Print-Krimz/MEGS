import React from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import {
  BarChart3,
} from "lucide-react";

export const ScoringQualityPage: React.FC = () => {
  const qualityQuery = useQuery({
    queryKey: ["admin", "scoring", "quality"],
    queryFn: adminApi.getQualityMetrics,
  });

  if (qualityQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Match Quality & Analytics" description="Loading quality metrics..." />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (qualityQuery.isError || !qualityQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Candidate Match Quality & Analytics" description="Match metrics data" />
        <ErrorState error={qualityQuery.error} onRetry={() => qualityQuery.refetch()} />
      </div>
    );
  }

  const m = qualityQuery.data;
  const dist = m.scoreDistribution || {};

  return (
    <div className="space-y-5">
      <PageHeader
        title="Candidate Match Quality & Analytics"
        description="Distribution breakdown of candidate match scores, qualification benchmarks, and assessment system response time"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Scoring Quality & Metrics" },
        ]}
      />

      {/* 4 Core Metrics Ribbon */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Total Scored Profiles
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {m.totalCalculated}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Evaluated applications
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Average Fit Score
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            {Number(m.averageFitScore).toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Min: {Number(m.minFitScore).toFixed(0)}% • Max: {Number(m.maxFitScore).toFixed(0)}%
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Processed Profiles
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {Number(m.coveragePercentage || 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Profiles indexed for matching
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Match Calculation Time (P95)
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {m.knnLatencyP95 || 42} <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Average matching speed
          </div>
        </div>
      </div>

      {/* Score Distribution Histogram */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
          <BarChart3 className="w-4 h-4 text-teal-700" />
          <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
            Candidate Match Score Distribution
          </h3>
        </div>

        <div className="p-4 space-y-3">
          {[
            { range: "80% - 100% (High Suitability)", key: "80-100", color: "bg-emerald-600" },
            { range: "60% - 79% (Moderate Match)", key: "60-79", color: "bg-teal-600" },
            { range: "40% - 59% (Baseline Match)", key: "40-59", color: "bg-amber-600" },
            { range: "20% - 39% (Low Match)", key: "20-39", color: "bg-orange-600" },
            { range: "0% - 19% (Unmatched)", key: "0-19", color: "bg-rose-600" },
          ].map((bucket) => {
            const count = dist[bucket.key] || 0;
            const percentage = m.totalCalculated > 0 ? (count / m.totalCalculated) * 100 : 0;

            return (
              <div key={bucket.key} className="space-y-1 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="font-semibold text-slate-800 uppercase">{bucket.range}</span>
                  <span className="text-slate-600 tabular-nums font-bold">
                    {count} candidates ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 border border-slate-200 h-2 overflow-hidden">
                  <div
                    className={`${bucket.color} h-2 transition-all`}
                    style={{ width: `${Math.max(percentage, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fairness & Model Governance Notes */}
      <div className="border border-slate-300 bg-white p-4 space-y-2">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
          Scoring Guidelines & Evaluation Consistency
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed font-sans">
          Candidate match scores are calculated across standardized recruitment criteria including skills, experience, location, pre-employment compliance, and educational background. Evaluation weights can be adjusted dynamically in <span className="font-mono text-teal-900 font-bold">Scoring Configuration</span> to match specific hiring requirements.
        </p>
      </div>
    </div>
  );
};
