import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { taApi } from "../../lib/api/ta.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button, Select } from "../../components/ui";
import {
  AnalyticsFilterBar,
  RecruitmentActivityChart,
  RecruitmentFunnel,
  PendingActionsWidget,
} from "../../components/analytics";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import {
  Users,
  Calendar,
  Building2,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  Download,
  CheckCircle2,
} from "lucide-react";

export const AnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    range: "30d",
  });
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx">("pdf");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Unified TA Recruitment Intelligence Dashboard Query (Single concurrent HTTP request)
  const dashboardQuery = useQuery({
    queryKey: ["ta", "analytics", "dashboard", filters],
    queryFn: () => taApi.getDashboardSummary(filters),
    staleTime: 60 * 1000,
  });

  const isLoading = dashboardQuery.isLoading;
  const isError = dashboardQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recruitment Operations Intelligence"
          description="Loading personal recruitment workload and telemetry..."
        />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Recruitment Operations Intelligence"
          description="Personal recruitment pipeline & workload intelligence"
        />
        <ErrorState
          error={dashboardQuery.error}
          onRetry={() => dashboardQuery.refetch()}
        />
      </div>
    );
  }

  const overview = dashboardQuery.data?.overview;
  const activity = dashboardQuery.data?.activity;
  const funnel = dashboardQuery.data?.funnel;
  const actions = dashboardQuery.data?.pendingActions || [];
  const options = dashboardQuery.data?.filterOptions;

  const handleExportPipeline = async () => {
    try {
      setExportError(null);
      setDownloadingReport("pipeline");
      const blob = await taApi.exportPipelineReport(exportFormat, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pipeline_report_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError("Failed to export pipeline report: " + err.message);
    } finally {
      setDownloadingReport(null);
    }
  };

  const handleExportDeployments = async () => {
    try {
      setExportError(null);
      setDownloadingReport("deployments");
      const blob = await taApi.exportDeploymentReport(exportFormat, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deployment_report_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError("Failed to export deployment report: " + err.message);
    } finally {
      setDownloadingReport(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment reports"
        description="Recruiter workload tracking, personalized daily recruitment trend, candidate funnel velocity, and actionable task queue"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Reports" },
        ]}
      />

      {exportError && (
        <div className="p-3 border-l-4 border-rose-600 bg-rose-50 border border-slate-300 text-rose-900 text-xs font-mono flex items-center justify-between">
          <span>{exportError}</span>
          <button
            onClick={() => setExportError(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Relational Filter Ribbon (No Recruiter selector for TA, only MRF, Job, Stage, Dates) */}
      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        options={options}
        showClientFilter={false}
        showRecruiterFilter={false}
      />

      {/* Row 1: 6 TA-Scoped Workload KPI Cards */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 divide-x divide-slate-300">
        {/* My Active Applications */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            My Active Pipeline
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {overview?.myActiveApplications ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Assigned candidates</span>
          </div>
        </div>

        {/* Initial Interviews Pending */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Screening Pending
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {overview?.initialInterviewsPending ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Calendar className="w-3 h-3 text-blue-700 shrink-0" />
            <span>Awaiting interview</span>
          </div>
        </div>

        {/* Ready for Endorsement */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Ready to Endorse
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            {overview?.readyForEndorsement ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3 text-teal-700 shrink-0" />
            <span>Passed screening</span>
          </div>
        </div>

        {/* Pending Client Acceptance */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-purple-800 uppercase tracking-wider">
            Client Acceptance
          </div>
          <div className="text-2xl font-bold font-mono text-purple-950 mt-0.5 tabular-nums">
            {overview?.pendingClientDecisions ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Building2 className="w-3 h-3 text-purple-700 shrink-0" />
            <span>Under client review</span>
          </div>
        </div>

        {/* Final Interviews Pending */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
            Final Interviews
          </div>
          <div className="text-2xl font-bold font-mono text-amber-950 mt-0.5 tabular-nums">
            {overview?.finalInterviewsPending ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-amber-700 shrink-0" />
            <span>Final panel stage</span>
          </div>
        </div>

        {/* Awaiting Compliance */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            201 Compliance
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {overview?.awaitingCompliance ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <FileCheck2 className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>Clearance checklist</span>
          </div>
        </div>
      </div>

      {/* Row 2: TA-Scoped Daily Recruitment Trend Graph */}
      <RecruitmentActivityChart
        data={activity}
        title="My Recruitment Activity Trend"
        subtitle="Daily volume of candidate reviews, initial screening interviews, client submissions, final evaluations, and site deployments for your requisitions"
      />

      {/* Row 3: Funnel & Pending Workload Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecruitmentFunnel
          data={funnel}
          title="My Candidate Pipeline Funnel"
          subtitle="Candidate conversion progression across stages for your assigned job requisitions"
        />

        <PendingActionsWidget actions={actions} />
      </div>

      {/* Row 4: Executive Report Export Center */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Recruitment Report Export Center
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Download structured records for billing audits, KPI evaluations, and client delivery reports
            </p>
          </div>

          <div className="w-48">
            <Select
              label=""
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "pdf" | "xlsx")}
              options={[
                { value: "pdf", label: "PDF Document (.pdf)" },
                { value: "xlsx", label: "Excel Spreadsheet (.xlsx)" },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-300">
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold font-mono uppercase text-slate-900 text-xs">
                Full Pipeline Activity Report
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                All candidate application records & match evaluations
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              loading={downloadingReport === "pipeline"}
              onClick={handleExportPipeline}
            >
              Export Report
            </Button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold font-mono uppercase text-slate-900 text-xs">
                Site Deployment Audit Report
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                Client assignments & contract dates
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              loading={downloadingReport === "deployments"}
              onClick={handleExportDeployments}
            >
              Export Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
