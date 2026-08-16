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
  Truck,
  Download,
  FileSpreadsheet,
  BarChart3,
} from "lucide-react";

export const AnalyticsPage: React.FC = () => {
  const [exportFormat, setExportFormat] = useState<"pdf" | "xlsx">("pdf");
  const [downloadingReport, setDownloadingReport] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const pipelineQuery = useQuery({
    queryKey: ["ta", "analytics", "pipeline"],
    queryFn: taApi.getPipelineAnalytics,
  });

  const timeToFillQuery = useQuery({
    queryKey: ["ta", "analytics", "time-to-fill"],
    queryFn: taApi.getTimeToFillAnalytics,
  });

  const deploymentQuery = useQuery({
    queryKey: ["ta", "analytics", "deployments"],
    queryFn: taApi.getDeploymentAnalytics,
  });

  const complianceQuery = useQuery({
    queryKey: ["ta", "analytics", "compliance"],
    queryFn: taApi.getComplianceOverview,
  });

  const isLoading =
    pipelineQuery.isLoading ||
    timeToFillQuery.isLoading ||
    deploymentQuery.isLoading ||
    complianceQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recruitment Analytics & Reports" description="Loading metrics..." />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  const isError =
    pipelineQuery.isError ||
    timeToFillQuery.isError ||
    deploymentQuery.isError ||
    complianceQuery.isError;

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recruitment Analytics & Reports" description="Analytics" />
        <ErrorState
          error={
            pipelineQuery.error ||
            timeToFillQuery.error ||
            deploymentQuery.error ||
            complianceQuery.error
          }
          onRetry={() => {
            pipelineQuery.refetch();
            timeToFillQuery.refetch();
            deploymentQuery.refetch();
            complianceQuery.refetch();
          }}
        />
      </div>
    );
  }

  const pipeline = pipelineQuery.data;
  const timeToFill = timeToFillQuery.data;
  const deployments = deploymentQuery.data;
  const compliance = complianceQuery.data;

  const handleExportPipeline = async () => {
    try {
      setExportError(null);
      setDownloadingReport("pipeline");
      const blob = await taApi.exportPipelineReport(exportFormat);
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
      const blob = await taApi.exportDeploymentReport(exportFormat);
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
        title="Recruitment Analytics & Operations Intelligence"
        description="Pipeline conversion velocity, average time-to-fill, deployment ratios, and executive report export center"
        breadcrumbs={[
          { label: "TA Portal", href: "/ta" },
          { label: "Analytics" },
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

      {/* 4 Headline Performance Indicators Ribbon */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Total Intake Volume
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {pipeline?.totalApplications || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {pipeline?.archivedApplications || 0} archived
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-blue-800 uppercase tracking-wider">
            Avg Time-To-Fill
          </div>
          <div className="text-2xl font-bold font-mono text-blue-950 mt-0.5 tabular-nums">
            {timeToFill?.averageDaysToFill ? Number(timeToFill.averageDaysToFill).toFixed(1) : "0.0"}{" "}
            <span className="text-xs text-slate-400 font-normal font-sans">days</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            {timeToFill?.totalFilledDeployments || 0} completed orders
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Active Site Deployments
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {deployments?.totalDeployments || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            On-site field personnel
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            201 Clearances Processed
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            {compliance?.totalRequirements || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            Verified statutory documents
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pipeline Stage Funnel Breakdown */}
        <div className="border border-slate-300 bg-white">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <BarChart3 className="w-4 h-4 text-teal-700" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Candidate Pipeline Stage Distribution
            </h3>
          </div>

          <div className="divide-y divide-slate-200 text-xs font-mono">
            {pipeline?.statusBreakdown &&
              Object.entries(pipeline.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-700 uppercase">{status.replace(/_/g, " ")}</span>
                  <span className="font-bold text-slate-950 tabular-nums">{count} candidates</span>
                </div>
              ))}
          </div>
        </div>

        {/* Deployment Status Machine Breakdown */}
        <div className="border border-slate-300 bg-white">
          <div className="p-3 border-b border-slate-300 flex items-center gap-2 bg-slate-100">
            <Truck className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
              Site Deployment Status Breakdown
            </h3>
          </div>

          <div className="divide-y divide-slate-200 text-xs font-mono">
            {deployments?.statusBreakdown &&
              Object.entries(deployments.statusBreakdown).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-700 uppercase">{status.replace(/_/g, " ")}</span>
                  <span className="font-bold text-slate-950 tabular-nums">{count} assignments</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Export Report Center */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Executive Report Export Hub
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Download structured data for billing audits, KPI evaluations, and client delivery reports
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
              <div className="text-[11px] text-slate-500 font-sans">All candidate application records & match evaluations</div>
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
              <div className="text-[11px] text-slate-500 font-sans">Client assignments & contract dates</div>
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
