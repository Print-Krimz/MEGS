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
  const metric = (value: number | undefined | null, decimals = 0) =>
    value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) + "%" : "Not available";
  const p95Latency = m.knnLatencyP95;

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
          <div className="flex flex-wrap items-center gap-2">
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
       <div className="admin-panel grid grid-cols-2 lg:grid-cols-3 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-xs font-sans font-bold text-slate-500  ">
            Candidates scored
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-0.5 tabular-nums">
            {totalCalculated}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-sans">
            Applications evaluated
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-xs font-sans font-bold text-navy  ">
            Average match score
          </div>
          <div className="text-2xl font-bold font-sans text-navy mt-0.5 tabular-nums">
            {metric(m.averageFitScore, 1)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-sans">
            Min: {metric(m.minFitScore)} · Max: {metric(m.maxFitScore)}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-xs font-sans font-bold text-blue-800  ">
            Candidates ready for matching
          </div>
          <div className="text-2xl font-bold font-sans text-blue-950 mt-0.5 tabular-nums">
            {metric(m.coveragePercentage)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-sans">
            Profiles ready for matching
          </div>
        </div>

      </div>

      {/* Score Distribution Histogram */}
      <div className="admin-panel">
        <div className="p-3 border-b border-slate-300 flex flex-wrap items-center gap-2 bg-slate-100">
          <BarChart3 className="w-4 h-4 text-navy" />
          <h3 className="text-sm font-semibold font-sans text-slate-900">
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
              <div key={bucket.key} className="space-y-1 text-sm">
                <div className="flex flex-wrap justify-between gap-2 font-sans">
                  <span className="font-semibold text-slate-800 ">{bucket.range}</span>
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

      <details className="admin-panel p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Technical performance</summary>
        <p className="mt-2 text-sm text-slate-600">{p95Latency != null && Number.isFinite(p95Latency)
          ? `95% of match calculations finish within ${p95Latency} milliseconds.`
          : "Calculation timing is not available."}</p>
      </details>

      {/* Matching guidance */}
      <div className="admin-panel p-4 space-y-2">
        <h4 className="text-sm font-semibold font-sans text-slate-900 border-b border-slate-200 pb-1.5">
          How matching works
        </h4>
        <p className="text-sm text-slate-600 leading-relaxed font-sans">
            Candidate match scores consider skills, experience, location, requirements, and education. You can change their importance in{" "}
          <Link to="/admin/scoring" className="font-sans text-navy font-bold underline hover:text-navy">
            Matching settings
          </Link>{" "}
          to match specific hiring requirements.
        </p>
      </div>
    </div>
  );
};
