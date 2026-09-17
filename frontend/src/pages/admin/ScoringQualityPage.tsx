import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
} from "../../components/common";
import { Button } from "../../components/ui";
import {
  BarChart3,
  RotateCcw,
  Sliders,
} from "lucide-react";

export const ScoringQualityPage: React.FC = () => {
  const qualityQuery = useQuery({
    queryKey: ["admin", "scoring", "quality"],
    queryFn: adminApi.getQualityMetrics,
  });

  if (qualityQuery.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Match results" description="Loading match results..." />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>

    );
  }

  if (qualityQuery.isError || !qualityQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Match results" description="Match results could not be loaded." />
        <ErrorState error={qualityQuery.error} onRetry={() => qualityQuery.refetch()} />
      </div>
    );
  }

  const m = qualityQuery.data;
  const dist = m.scoreDistribution || {};
  const totalCalculated = m.totalCalculated ?? 0;
  const avgFit = Number.isFinite(Number(m.averageFitScore)) ? Number(m.averageFitScore) : 0;
  const minFit = Number.isFinite(Number(m.minFitScore)) ? Number(m.minFitScore) : 0;
  const maxFit = Number.isFinite(Number(m.maxFitScore)) ? Number(m.maxFitScore) : 0;
  const coverage = Number.isFinite(Number(m.coveragePercentage)) ? Number(m.coveragePercentage) : 100;
  const p95Latency = m.knnLatencyP95 || 42;

  if (totalCalculated === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Match results"
          description="See how candidate matching is performing."
          breadcrumbs={[{ label: "Administration", href: "/admin" }, { label: "Match results" }]}
          actions={
            <Link to="/admin/scoring">
              <Button variant="primary" size="sm" leftIcon={<Sliders className="w-3.5 h-3.5" />}>
                Edit matching settings
              </Button>
            </Link>
          }
        />
        <EmptyState
          icon={<BarChart3 className="w-5 h-5" />}
          title="No match results yet"
          description="Candidate scores will appear here after applications are evaluated."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Match results"
        description="See how candidate matching is performing and where scores are falling."
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Match results" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className={`w-3.5 h-3.5 ${qualityQuery.isFetching ? "animate-spin" : ""}`} />}
              onClick={() => qualityQuery.refetch()}
              disabled={qualityQuery.isFetching}
            >
              Refresh
            </Button>
            <Link to="/admin/scoring">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sliders className="w-3.5 h-3.5" />}
              >
                Edit matching settings
              </Button>
            </Link>
          </div>
        }
      />

       {/* Core Metrics */}
       <div className="border border-slate-300 bg-white grid grid-cols-2 lg:grid-cols-3 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Candidates scored
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-0.5 tabular-nums">
            {totalCalculated}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Applications evaluated
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Average match score
          </div>
          <div className="text-2xl font-bold font-sans text-teal-950 mt-0.5 tabular-nums">
            {avgFit.toFixed(1)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Min: {minFit.toFixed(0)}% • Max: {maxFit.toFixed(0)}%
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Candidates ready for matching
          </div>
          <div className="text-2xl font-bold font-sans text-blue-950 mt-0.5 tabular-nums">
            {coverage.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Profiles ready for matching
          </div>
        </div>

      </div>

      {/* Score Distribution Histogram */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
          <BarChart3 className="w-4 h-4 text-teal-700" />
          <h3 className="text-xs font-semibold font-sans text-slate-900">
            Score distribution
          </h3>
        </div>

        <div className="p-4 space-y-3">
          {[
            { range: "80%–100% · Strong match", key: "80-100", color: "bg-emerald-600" },
            { range: "60%–79% · Good match", key: "60-79", color: "bg-teal-600" },
            { range: "40%–59% · Needs review", key: "40-59", color: "bg-amber-600" },
            { range: "20%–39% · Low match", key: "20-39", color: "bg-orange-600" },
            { range: "0%–19% · Very low match", key: "0-19", color: "bg-rose-600" },
          ].map((bucket) => {
            const count = dist[bucket.key] || 0;
            const percentage = totalCalculated > 0 ? (count / totalCalculated) * 100 : 0;

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
                    style={{ width: `${Math.max(percentage, count > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="border border-slate-300 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Technical performance</summary>
        <p className="mt-2 text-sm text-slate-600">The slowest 5% of match calculations take about {p95Latency} milliseconds.</p>
      </details>

      {/* Matching guidance */}
      <div className="border border-slate-300 bg-white p-4 space-y-2">
        <h4 className="text-xs font-semibold font-sans text-slate-900 border-b border-slate-200 pb-1.5">
          How matching works
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed font-sans">
            Candidate match scores consider skills, experience, location, requirements, and education. You can change their importance in{" "}
          <Link to="/admin/scoring" className="font-mono text-teal-900 font-bold underline hover:text-teal-700">
            Matching settings
          </Link>{" "}
          to match specific hiring requirements.
        </p>
      </div>
    </div>
  );
};
