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
import { AnalyticsPanel, KpiRow } from "../../components/analytics";
import { BarMark } from "../../components/analytics/chart-primitives";
import { BarChart3, RotateCcw } from "lucide-react";

// One hue, darker for stronger matches, so the bars read as one scale.
const BUCKETS = [
  { range: "80–100%", label: "Strong match", key: "80-100", color: "#0B315D" },
  { range: "60–79%", label: "Good match", key: "60-79", color: "#1A4A80" },
  { range: "40–59%", label: "Needs review", key: "40-59", color: "#33689C" },
  { range: "20–39%", label: "Low match", key: "20-39", color: "#4E80B2" },
  { range: "0–19%", label: "Very low match", key: "0-19", color: "#698FBF" },
];

const Kpi: React.FC<{ label: string; value: React.ReactNode; detail?: string }> = ({ label, value, detail }) => (
  <div className="p-3.5">
    <div className="text-xs font-semibold text-slate-700">{label}</div>
    <div className="mt-0.5 text-2xl font-bold tabular-nums text-slate-950">{value}</div>
    {detail && <div className="mt-0.5 text-xs text-slate-700">{detail}</div>}
  </div>
);

export const ScoringQualityPage: React.FC = () => {
  const qualityQuery = useQuery({
    queryKey: ["admin", "scoring", "quality"],
    queryFn: adminApi.getQualityMetrics,
  });

  if (qualityQuery.isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Match results" flush />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>

    );
  }

  if (qualityQuery.isError || !qualityQuery.data) {
    return (
      <div className="space-y-5">
        <PageHeader title="Match results" flush />
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
          flush
          breadcrumbs={[{ label: "Administration", href: "/admin" }, { label: "Match results" }]}
          actions={
            <Button asChild variant="primary" size="sm">
              <Link to="/admin/scoring">Edit matching settings</Link>
            </Button>
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
        flush
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Match results" },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RotateCcw className={`w-3.5 h-3.5 ${qualityQuery.isFetching ? "motion-safe:animate-spin" : ""}`} />}
              onClick={() => qualityQuery.refetch()}
              disabled={qualityQuery.isFetching}
            >
              Refresh
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link to="/admin/scoring">Edit matching settings</Link>
            </Button>
          </>
        }
      />

      <KpiRow columns="lg:grid-cols-3">
        <Kpi label="Candidates scored" value={totalCalculated} />
        <Kpi label="Average match score" value={metric(m.averageFitScore, 1)} detail={`Lowest ${metric(m.minFitScore)} · highest ${metric(m.maxFitScore)}`} />
        <Kpi label="Candidates ready for matching" value={metric(m.coveragePercentage)} />
      </KpiRow>

      <AnalyticsPanel title="Score distribution" aside={`${totalCalculated} candidates`}>
        <ul className="divide-y divide-slate-200">
          {BUCKETS.map((bucket) => {
            const count = dist[bucket.key] || 0;
            const percentage = totalCalculated > 0 ? (count / totalCalculated) * 100 : 0;
            return (
              <li key={bucket.key} className="grid grid-cols-1 gap-1.5 px-3.5 py-2.5 text-sm sm:grid-cols-[12rem_minmax(0,1fr)_8rem] sm:items-center sm:gap-4">
                <span>
                  <span className="font-medium text-slate-900">{bucket.label}</span>
                  <span className="ml-1.5 text-xs text-slate-600 tabular-nums">{bucket.range}</span>
                </span>
                <BarMark label={bucket.label} value={count} max={totalCalculated} color={bucket.color} pct={`${percentage.toFixed(1)}%`} />
                <span className="text-slate-700 tabular-nums sm:text-right">
                  {count} <span className="text-slate-600">({percentage.toFixed(1)}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </AnalyticsPanel>

      <p className="text-xs text-slate-600">
        {p95Latency != null && Number.isFinite(p95Latency)
          ? `95% of match calculations finish within ${p95Latency} milliseconds.`
          : "Calculation timing is not available."}
      </p>
    </div>
  );
};
