import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import {
  AnalyticsFilterBar,
  RecruitmentActivityChart,
  RecruitmentFunnel,
  BottlenecksWidget,
  ApplicationsByJobChart,
} from "../../components/analytics";
import { Button, Select } from "../../components/ui";
import type { AnalyticsFilterState } from "../../lib/types/analytics.types";
import {
  Users,
  UserCheck,
  Building2,
  FileCheck2,
  Send,
  FileSpreadsheet,
  Download,
} from "lucide-react";

export const AdminAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    range: "30d",
  });
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx">("pdf");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Unified Organization Recruitment Analytics Dashboard Query (Single concurrent HTTP request)
  const dashboardQuery = useQuery({
    queryKey: ["admin", "analytics", "dashboard", filters],
    queryFn: () => adminApi.getDashboardSummary(filters),
    staleTime: 60 * 1000,
  });

  const isLoading = dashboardQuery.isLoading;
  const isError = dashboardQuery.isError;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Organization Recruitment Analytics"
          description="Loading real-time recruitment metrics..."
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
          title="Organization Recruitment Analytics"
          description="Recruitment metrics & pipeline health"
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
  const bottlenecks = dashboardQuery.data?.bottlenecks || [];
  const jobDemands = dashboardQuery.data?.jobDemands || [];
  const options = dashboardQuery.data?.filterOptions;

  const handleExportPipeline = async () => {
    try {
      setExportError(null);
      setDownloadingReport("pipeline");
      const blob = await adminApi.exportPipelineReport(exportFormat, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEGS_Admin_Workforce_Pipeline_Report_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
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
      const blob = await adminApi.exportDeploymentReport(exportFormat, filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEGS_Admin_Deployment_Governance_${new Date().toISOString().substring(0, 10)}.${exportFormat}`;
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
        title="Organization Recruitment Reports"
        description="Company-wide hiring progress, daily recruitment activity, stage conversion rates, and review bottlenecks"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
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

      {/* Reusable Relational Filter Ribbon */}
      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        options={options}
        showClientFilter={true}
        showRecruiterFilter={true}
      />

      {/* Row 1: 6 Core Organization KPI Cards */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 divide-x divide-slate-300">
        {/* Total Applications */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Total Applications
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-0.5 tabular-nums">
            {overview?.totalApplications ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Users className="w-3 h-3 text-slate-400 shrink-0" />
            <span>Intake volume</span>
          </div>
        </div>

        {/* Active Candidates */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Active Candidates
          </div>
          <div className="text-2xl font-bold font-sans text-teal-950 mt-0.5 tabular-nums">
            {overview?.activeCandidates ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <UserCheck className="w-3 h-3 text-teal-700 shrink-0" />
            <span>In active pipeline</span>
          </div>
        </div>

        {/* Talent Pool Candidates */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-purple-800 uppercase tracking-wider">
            Talent Pool
          </div>
          <div className="text-2xl font-bold font-sans text-purple-950 mt-0.5 tabular-nums">
            {overview?.talentPoolCandidates ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Users className="w-3 h-3 text-purple-700 shrink-0" />
            <span>Sourced & reactivatable</span>
          </div>
        </div>

        {/* Client Endorsements */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Client Endorsements
          </div>
          <div className="text-2xl font-bold font-sans text-blue-950 mt-0.5 tabular-nums">
            {overview?.clientEndorsements ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Building2 className="w-3 h-3 text-blue-700 shrink-0" />
            <span>Presented to clients</span>
          </div>
        </div>

        {/* Candidates in Compliance */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
            In Requirements
          </div>
          <div className="text-2xl font-bold font-sans text-amber-950 mt-0.5 tabular-nums">
            {overview?.candidatesInCompliance ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <FileCheck2 className="w-3 h-3 text-amber-700 shrink-0" />
            <span>Pre-employment requirements</span>
          </div>
        </div>

        {/* Total Deployments */}
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Total Deployments
          </div>
          <div className="text-2xl font-bold font-sans text-emerald-950 mt-0.5 tabular-nums">
            {overview?.totalDeployments ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
            <Send className="w-3 h-3 text-emerald-700 shrink-0" />
            <span>Deployed personnel</span>
          </div>
        </div>
      </div>

      {/* Row 2: Prominent Daily Recruitment Activity Trend Graph */}
      <RecruitmentActivityChart
        data={activity}
        title="Organization Recruitment Activity Trend"
        subtitle="Daily breakdown of candidate intake, initial interviews, client endorsements, final interviews, compliance clearances, and site deployments"
      />

      {/* Row 3: Funnel & Requisition Demand Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecruitmentFunnel data={funnel} />
        <ApplicationsByJobChart data={jobDemands} />
      </div>

      {/* Row 4: Bottleneck Aging Analysis */}
      <BottlenecksWidget bottlenecks={bottlenecks} />

      {/* Row 5: Report Export Center */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-semibold font-sans text-slate-900">
                Export Reports
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-200 text-slate-700 border border-slate-300">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Download pipeline and deployment records in PDF or Excel
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
              <div className="font-semibold font-sans text-slate-900 text-xs">
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
              Export Report
            </Button>
          </div>

          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold font-sans text-slate-900 text-xs">
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
              Export Report
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
