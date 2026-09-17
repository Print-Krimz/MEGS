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
  Users2,
} from "lucide-react";
import { formatAdminBackupStatus, formatAdminRole } from "../../lib/admin-copy";
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
    auditLogsQuery.isLoading ||
    qualityQuery.isLoading;

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
    auditLogsQuery.isError ||
    qualityQuery.isError;

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
            auditLogsQuery.error ||
            qualityQuery.error
          }
          onRetry={() => {
            usersQuery.refetch();
            scoringConfigQuery.refetch();
            backupsQuery.refetch();
            auditLogsQuery.refetch();
            qualityQuery.refetch();
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
        description="Manage users, view hiring reports, and review system records."
        breadcrumbs={[{ label: "Administration" }]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/users">
              <Button variant="primary" size="sm" leftIcon={<Users2 className="w-3.5 h-3.5" />}>
                Manage users
              </Button>
            </Link>
            <Link to="/admin/analytics">
              <Button variant="outline" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5 text-teal-700" />}>
                View reports
              </Button>
            </Link>
          </div>
        }
      />

      {/* 4 Core Administration Metrics Ribbon */}
      <div className="border border-slate-300 bg-white grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-slate-300">
        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            User accounts
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-0.5 tabular-nums">
            {totalUsers}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {taCount} recruiters • {adminCount} administrators
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-teal-800 uppercase tracking-wider">
            Matching settings
          </div>
          <div className="text-2xl font-bold font-sans text-teal-950 mt-0.5 tabular-nums">
            Active
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            Last updated {config?.activatedAt ? formatDate(config.activatedAt) : "using defaults"}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-indigo-800 uppercase tracking-wider">
            Backups available
          </div>
          <div className="text-2xl font-bold font-sans text-slate-950 mt-0.5 tabular-nums">
            {backups.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {latestBackup ? `${formatAdminBackupStatus(latestBackup.status)} • ${formatDate(latestBackup.createdAt)}` : "No backups yet"}
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
            Average match score
          </div>
          <div className="text-2xl font-bold font-sans text-emerald-950 mt-0.5 tabular-nums">
            {quality?.averageFitScore ? Number(quality.averageFitScore).toFixed(1) : "0.0"}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
            {quality?.totalCalculated || 0} candidates scored
          </div>
        </div>
      </div>

      {/* AI Scoring Weight Configuration Distribution */}
      <div className="border border-slate-300 bg-white">
        <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-700" />
              <h3 className="text-xs font-semibold font-sans text-slate-900">
                Matching settings
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              How candidate match scores are calculated
            </p>
          </div>
          <Link to="/admin/scoring">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              Edit settings
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-slate-300">
          {[
            { label: "Skills", key: "SKILLS", defaultVal: 30 },
            { label: "Experience", key: "EXPERIENCE", defaultVal: 25 },
            { label: "Location", key: "LOCATION", defaultVal: 15 },
            { label: "Requirements", key: "COMPLIANCE", defaultVal: 15 },
            { label: "Education", key: "EDUCATION_CERTIFICATIONS", defaultVal: 15 },
          ].map((dim) => {
            const val = weights[dim.key] !== undefined ? weights[dim.key] : dim.defaultVal;
            return (
              <div
                key={dim.key}
                className="p-3.5 bg-white text-center hover:bg-slate-50 transition-colors"
              >
                <div className="text-xl font-bold font-sans text-slate-950 tabular-nums">
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
              <h3 className="text-xs font-semibold font-sans text-slate-900">
                Recent activity
              </h3>
            </div>
            <Link to="/admin/audit">
              <Button variant="ghost" size="sm">
                View all activity →
              </Button>
            </Link>
          </div>

          {logs.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-400">
              No recent activity yet.
            </div>
          ) : (
            <>
            <div className="md:hidden divide-y divide-slate-200">
              {logs.map((log) => {
                const category = getActionCategory(log.action);
                const targetEntity = formatTargetEntity(log);
                return (
                  <div key={log.id} className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-sm text-slate-950">{formatAction(log.action)}</span>
                      <span className="shrink-0 text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {targetEntity.label}{targetEntity.secondary ? ` · ${targetEntity.secondary}` : ""}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.user?.email || formatAdminRole(log.user?.role)} · {category}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                  <tr>
                    <th className="px-3.5 py-2.5 font-bold">What happened</th>
                    <th className="px-3.5 py-2.5 font-bold">Performed by</th>
                    <th className="px-3.5 py-2.5 font-bold">Affected record</th>
                    <th className="px-3.5 py-2.5 font-bold text-right">When</th>
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
            </>
          )}
        </div>

        {/* Right Col: Data Backups Widget */}
        <div className="space-y-4">
          <div className="border border-slate-300 bg-white">
            <div className="p-3 border-b border-slate-300 flex items-center justify-between bg-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-700" />
                <h3 className="text-xs font-semibold font-sans text-slate-900">
                  Backups
                </h3>
              </div>
              <Link to="/admin/maintenance" className="text-[11px] font-mono text-indigo-800 font-bold hover:underline">
                View backups →
              </Link>
            </div>

            <div className="p-3.5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 text-[11px]">Latest backup:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  latestBackup?.status === "SUCCESS"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : latestBackup?.status === "FAILED"
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-slate-100 text-slate-700 border border-slate-300"
                }`}>
                  {formatAdminBackupStatus(latestBackup?.status)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 text-[11px]">Protection:</span>
                <span className="text-slate-900 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Encrypted
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 text-[11px]">Created:</span>
                <span className="text-slate-900 text-[11px]">
                  {latestBackup ? formatDateTime(latestBackup.createdAt) : "Never"}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <Link to="/admin/maintenance" className="block w-full">
                  <Button variant="outline" size="sm" className="w-full justify-center">
                    View backups
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
