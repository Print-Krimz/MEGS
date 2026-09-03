import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
} from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { Role } from "../../lib/types/enums";
import {
  Sliders,
  ArrowRight,
  BarChart3,
  Database,
  ShieldCheck,
} from "lucide-react";
import {
  formatAction,
  getActionCategory,
  getCategoryBadgeClass,
  formatTargetEntity,
} from "../../lib/utils/audit-formatter";

export const AdminDashboard: React.FC = () => {
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: adminApi.listUsers,
  });

  const scoringConfigQuery = useQuery({
    queryKey: ["admin", "scoring", "config"],
    queryFn: adminApi.getScoringConfig,
  });

  const backupsQuery = useQuery({
    queryKey: ["admin", "maintenance", "backups"],
    queryFn: () => adminApi.listDatabaseBackups(5),
  });

  const qualityQuery = useQuery({
    queryKey: ["admin", "scoring", "quality"],
    queryFn: adminApi.getQualityMetrics,
  });

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit", "recent"],
    queryFn: () => adminApi.listAuditLogs({ limit: 6 }),
  });

  const isLoading =
    usersQuery.isLoading ||
    scoringConfigQuery.isLoading ||
    backupsQuery.isLoading ||
    auditLogsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Administration overview"
          description="Loading administration information..."
        />
        <LoadingState variant="cards" />
        <LoadingState variant="table" rows={4} />
      </div>
    );
  }

  const isError =
    usersQuery.isError ||
    scoringConfigQuery.isError ||
    backupsQuery.isError ||
    auditLogsQuery.isError;

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Administration overview"
          description="Administration information"
        />
        <ErrorState
          error={
            usersQuery.error ||
            scoringConfigQuery.error ||
            backupsQuery.error ||
            auditLogsQuery.error
          }
          onRetry={() => {
            usersQuery.refetch();
            scoringConfigQuery.refetch();
            backupsQuery.refetch();
            auditLogsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const users = usersQuery.data || [];
  const config = scoringConfigQuery.data;
  const backups = backupsQuery.data || [];
  const latestBackup = backups[0];
  const quality = qualityQuery.data;
  const logs = auditLogsQuery.data || [];

  const totalUsers = users.length;
  const taCount = users.filter((u) => u.role === Role.TALENT_ACQUISITION).length;
  const adminCount = users.filter((u) => u.role === Role.ADMINISTRATOR).length;

  const weights = (config?.weights as Record<string, number>) || {};

  return (
    <div className="space-y-5">
      <PageHeader
        title="Administration overview"
        description="Manage access, matching settings, database snapshots, and activity."
        breadcrumbs={[{ label: "Administration" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/analytics">
              <Button variant="outline" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5 text-teal-700" />}>
                Reports
              </Button>
            </Link>
            <Link to="/admin/scoring">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Sliders className="w-3.5 h-3.5" />}
              >
                Configure Weights
              </Button>
            </Link>
          </div>
        }
      />

      {/* 4 Core Administration Metrics Ribbon */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Registered Accounts
          </div>
          <div className="text-2xl font-bold font-mono text-slate-950 mt-0.5 tabular-nums">
            {totalUsers}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {taCount} TA Specialists • {adminCount} Admins
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Active Scoring Config
          </div>
          <div className="text-2xl font-bold font-mono text-teal-950 mt-0.5 tabular-nums">
            v{config?.version || 1}.{config?.revision || 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Activated {config?.activatedAt ? formatDate(config.activatedAt) : "Default"}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-indigo-800 uppercase tracking-wider">
            Database Snapshots
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-950 mt-0.5 tabular-nums">
            {backups.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {latestBackup ? `${latestBackup.status} • ${formatDate(latestBackup.createdAt)}` : "No snapshots yet"}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Average Match Score
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-0.5 tabular-nums">
            {quality?.averageFitScore ? Number(quality.averageFitScore).toFixed(1) : "0.0"}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {quality?.totalCalculated || 0} candidate profiles scored
          </div>
        </div>
      </div>

      {/* AI Scoring Weight Configuration Distribution */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Candidate Matching Weights
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              Evaluation criteria weights used to calculate candidate suitability and job match scores
            </p>
          </div>
          <Link to="/admin/scoring">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              Configure
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-300">
          {[
            { label: "Skills Match", key: "SKILLS", defaultVal: 30 },
            { label: "Experience Fit", key: "EXPERIENCE", defaultVal: 25 },
            { label: "Location Proximity", key: "LOCATION", defaultVal: 15 },
            { label: "Requirements", key: "COMPLIANCE", defaultVal: 15 },
            { label: "Education & Certs", key: "EDUCATION_CERTIFICATIONS", defaultVal: 15 },
          ].map((dim) => {
            const val = weights[dim.key] !== undefined ? weights[dim.key] : dim.defaultVal;
            return (
              <div
                key={dim.key}
                className="p-3.5 bg-white text-center hover:bg-slate-50 transition-colors"
              >
                <div className="text-xl font-bold font-mono text-slate-950 tabular-nums">
                  {val}%
                </div>
                <div className="text-[10px] font-mono font-bold uppercase text-slate-600 tracking-wider mt-0.5">
                  {dim.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid: Recent Audit Log & Database Maintenance Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Recent Security & Administrative Logs */}
        <div className="lg:col-span-2 border border-slate-300 bg-white overflow-hidden">
          <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-slate-700" />
              <h3 className="text-xs font-bold font-mono text-slate-900 uppercase tracking-wider">
                Administrative Audit Events
              </h3>
            </div>
            <Link to="/admin/audit">
              <Button variant="ghost" size="sm">
                Full Audit Trail →
              </Button>
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-400">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="px-3.5 py-2.5 font-bold">Action</th>
                    <th className="px-3.5 py-2.5 font-bold">Actor</th>
                    <th className="px-3.5 py-2.5 font-bold">Target Entity</th>
                    <th className="px-3.5 py-2.5 font-bold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => {
                    const category = getActionCategory(log.action);
                    const formattedAct = formatAction(log.action);
                    const targetEntity = formatTargetEntity(log);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-950 font-sans text-xs">
                              {formattedAct}
                            </span>
                            <span
                              className={`inline-block w-fit px-1.5 py-0.2 text-[9px] font-mono uppercase font-bold rounded-xs border ${getCategoryBadgeClass(
                                category
                              )}`}
                            >
                              {category}
                            </span>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 font-sans text-xs">
                          {log.user?.email || log.userId || "System"}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 font-sans text-xs">
                          <div className="flex flex-col">
                            <span>{targetEntity.label}</span>
                            {targetEntity.secondary && (
                              <span className="text-[10px] text-slate-400">
                                {targetEntity.secondary}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Col: Database Maintenance & Snapshots Widget */}
        <div className="space-y-4">
          <div className="border border-slate-300 bg-white">
            <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
                  Database Snapshots
                </h3>
              </div>
              <Link to="/admin/maintenance" className="text-[11px] font-mono text-indigo-800 font-bold hover:underline">
                Manage →
              </Link>
            </div>

            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 uppercase text-[11px]">Latest Status:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  latestBackup?.status === "SUCCESS"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : latestBackup?.status === "FAILED"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-slate-100 text-slate-700 border border-slate-300"
                }`}>
                  {latestBackup?.status || "READY"}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 uppercase text-[11px]">Encryption:</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  AES-256-GCM
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 uppercase text-[11px]">Last Backup:</span>
                <span className="text-slate-900 text-[11px]">
                  {latestBackup ? formatDateTime(latestBackup.createdAt) : "Never"}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <Link to="/admin/maintenance" className="block w-full">
                  <Button variant="outline" size="sm" className="w-full justify-center">
                    View Maintenance Console
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};