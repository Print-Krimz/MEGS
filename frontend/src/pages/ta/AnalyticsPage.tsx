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
import { formatErrorMessage } from "../../lib/feedback";
import { TA_COPY } from "../../lib/ta-copy";

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
          title="Recruitment reports"
          description="Loading recruitment activity..."
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
          title="Recruitment reports"
          description="Track your recruitment activity and pending work."
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
      a.download = `MEGS_TA_Candidate_Pipeline_Report_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(`Unable to export the pipeline report. ${formatErrorMessage(err)}`);
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
      a.download = `MEGS_TA_Deployment_Report_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(`Unable to export the deployment report. ${formatErrorMessage(err)}`);
    } finally {
      setDownloadingReport(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recruitment reports"
        description="Track active candidate stages, overdue reviews, and daily recruitment activity"
        breadcrumbs={[
          { label: TA_COPY.navigation.overview, href: "/ta" },
          { label: TA_COPY.navigation.reports },
        ]}
      />

      {exportError && (
        <div className="p-3 border border-rose-200 bg-rose-50 text-rose-900 text-sm font-sans flex items-center justify-between">
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            aria-label="Dismiss export error"
            className="text-slate-400 hover:text-slate-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Relational Filter Ribbon (No Recruiter selector for TA, only MRF, Job, Stage, Dates, Mine Only) */}
      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        options={options}
        showClientFilter={false}
        showRecruiterFilter={false}
        showMineOnlyFilter={true}
      />

      {/* Row 1: 6 TA-Scoped Workload KPI Cards */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 divide-x divide-slate-300">
        {/* Active Applications */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            {filters.mineOnly ? "My Active Pipeline" : "Active Pipeline"}
          </div>
          <div className="text-2xl font-sans font-bold text-slate-950 mt-0.5 tabular-nums">
            {overview?.myActiveApplications ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{filters.mineOnly ? "Assigned candidates" : "All active candidates"}</span>
          </div>
        </div>

        {/* Initial Interviews Pending */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Screening Pending
          </div>
          <div className="text-2xl font-sans font-bold text-blue-950 mt-0.5 tabular-nums">
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
            Ready to send to client
          </div>
          <div className="text-2xl font-sans font-bold text-teal-950 mt-0.5 tabular-nums">
            {overview?.readyForEndorsement ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3 h-3 text-teal-700 shrink-0" />
            <span>Passed screening</span>
          </div>
        </div>

        {/* Pending Client Acceptance */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-[#0B315D] uppercase tracking-wider">
            Client Acceptance
          </div>
          <div className="text-2xl font-sans font-bold text-[#082747] mt-0.5 tabular-nums">
            {overview?.pendingClientDecisions ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Building2 className="w-3 h-3 text-[#0B315D] shrink-0" />
            <span>Under client review</span>
          </div>
        </div>

        {/* Final Interviews Pending */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
            Final Interviews
          </div>
          <div className="text-2xl font-sans font-bold text-amber-950 mt-0.5 tabular-nums">
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
            Requirements
          </div>
          <div className="text-2xl font-sans font-bold text-emerald-950 mt-0.5 tabular-nums">
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
        title="Recruitment activity"
        subtitle="Daily candidate reviews, interviews, client reviews, and deployments."
      />

      {/* Row 3: Funnel & Pending Workload Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecruitmentFunnel
          data={funnel}
          title="Candidate pipeline"
          subtitle="How candidates move through each hiring stage."
        />

        <PendingActionsWidget actions={actions} />
      </div>

      {/* Row 4: Report Export Center */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Export reports
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-teal-50 text-teal-800 border border-teal-200">
                TA Portal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Download candidate pipeline and deployment records as PDF or Excel.
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
                Candidate Pipeline
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                Applications, stages, and match evaluations
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              loading={downloadingReport === "pipeline"}
              onClick={handleExportPipeline}
            >
                Export report
            </Button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-bold font-mono uppercase text-slate-900 text-xs">
                Deployments
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                Client assignments, sites, and contract dates
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              loading={downloadingReport === "deployments"}
              onClick={handleExportDeployments}
            >
                Export report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
