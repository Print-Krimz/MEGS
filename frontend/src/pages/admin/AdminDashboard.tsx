import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import type { AdminUserSummary } from "../../lib/api/admin.api";
import { PageHeader, ErrorState, EmptyState } from "../../components/common";
import { formatDate, formatDateTime } from "../../lib/utils";
import { formatAdminBackupStatus, formatAdminRole } from "../../lib/admin-copy";
import { formatAction, formatTargetEntity } from "../../lib/utils/audit-formatter";

function SectionData<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => React.ReactNode }) {
  if (query.isError) return <ErrorState error={query.error} onRetry={() => { void query.refetch(); }} />;
  if (query.isPending) return <div role="status" aria-label="Loading section" className="space-y-3 p-4 motion-safe:animate-pulse"><div className="h-6 w-24 rounded bg-surface-active" /><div className="h-3 w-3/4 rounded bg-surface-hover" /><span className="sr-only">Loading information</span></div>;
  return <>{children(query.data)}</>;
}

export const AdminDashboard: React.FC = () => {
  const userSummaryQuery = useQuery({
    queryKey: ["admin", "users", "summary"],
    queryFn: ({ signal }) => adminApi.getUserSummary({ signal }),
  });
  const configQuery = useQuery({ queryKey: ["admin", "scoring", "config"], queryFn: adminApi.getScoringConfig });
  const backupsQuery = useQuery({ queryKey: ["admin", "maintenance", "backups", 5], queryFn: () => adminApi.listDatabaseBackups(5) });
  const qualityQuery = useQuery({ queryKey: ["admin", "scoring", "quality"], queryFn: adminApi.getQualityMetrics });
  const auditQuery = useQuery({ queryKey: ["admin", "audit", "recent"], queryFn: () => adminApi.listAuditLogs({ limit: 6 }) });

  return (
    <div className="space-y-6">
      <PageHeader title="Administration overview" description="Review accounts, candidate matching, and recent system activity."
        breadcrumbs={[{ label: "Administration" }]}
        actions={<div className="admin-form-actions">
          <Link to="/admin/users" className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">Manage users</Link>
          <Link to="/admin/analytics" className="inline-flex min-h-11 items-center rounded-md border border-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-surface-hover">View reports</Link>
        </div>} />
      <div className="admin-panel admin-metrics">
        <section aria-label="User accounts"><h2>User accounts</h2>
          <SectionData<AdminUserSummary> query={userSummaryQuery}>{users => <><p className="admin-metric-value">{users.totalUsers}</p><p className="mt-1 text-xs text-slate-600">{users.recruiters} recruiters · {users.administrators} administrators</p></>}</SectionData>
        </section>
        <section aria-label="Latest backup"><h2>Latest backup</h2>
          <SectionData query={backupsQuery}>{backups => <><p className="admin-metric-value">{backups[0] ? formatAdminBackupStatus(backups[0].status) : "No backups"}</p><p className="mt-1 text-xs text-slate-600">{backups[0] ? formatDateTime(backups[0].createdAt) : "Create a backup in Backups and recovery."}</p></>}</SectionData>
        </section>
        <section aria-label="Matching settings status"><h2>Matching settings</h2>
          <SectionData query={configQuery}>{config => <><p className="admin-metric-value">{config?.status === "ACTIVE" ? "Active" : config?.status === "SUPERSEDED" ? "Superseded" : "Not available"}</p><p className="mt-1 text-xs text-slate-600">{config?.activatedAt ? "Updated " + formatDate(config.activatedAt) : "No configuration available."}</p></>}</SectionData>
        </section>
        <section aria-label="Average match score"><h2>Average match score</h2>
          <SectionData query={qualityQuery}>{quality => <><p className="admin-metric-value">{quality?.totalCalculated > 0 && quality.averageFitScore != null && Number.isFinite(Number(quality.averageFitScore)) ? Number(quality.averageFitScore).toFixed(1) + "%" : "Not available"}</p><p className="mt-1 text-xs text-slate-600">{quality?.totalCalculated ? quality.totalCalculated + " candidates scored" : "No candidates scored yet."}</p></>}</SectionData>
        </section>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="admin-panel xl:col-span-2" aria-labelledby="admin-recent-activity">
          <div className="admin-section-heading flex flex-wrap items-center justify-between gap-3"><h2 id="admin-recent-activity">Recent activity</h2><Link to="/admin/audit" className="admin-section-link">View all activity</Link></div>
          <SectionData query={auditQuery}>{logs => logs.length === 0 ? <EmptyState title="No recent activity" description="Account and system changes will appear here." /> : <>
            <div className="divide-y divide-border md:hidden">{logs.map(log => {
              const target = formatTargetEntity(log);
              return <article key={log.id} className="space-y-2 p-4"><h3>{formatAction(log.action)}</h3><p className="text-sm text-slate-600">{target.label}{target.secondary ? " · " + target.secondary : ""}</p><p className="break-words text-xs text-slate-600">{log.user?.email || formatAdminRole(log.user?.role)} · {formatDateTime(log.createdAt)}</p></article>;
            })}</div>
            <div className="hidden overflow-x-auto md:block"><table className="w-full text-left">
              <thead className="bg-page text-slate-600"><tr><th scope="col" className="px-5">What happened</th><th scope="col" className="px-5">Performed by</th><th scope="col" className="px-5">When</th></tr></thead>
              <tbody className="divide-y divide-border">{logs.map(log => {
                const target = formatTargetEntity(log);
                return <tr key={log.id} className="hover:bg-page"><td className="px-5"><p className="font-medium">{formatAction(log.action)}</p><p className="mt-1 text-xs text-slate-600">{target.label}{target.secondary ? " · " + target.secondary : ""}</p></td><td className="break-words px-5">{log.user?.email || "System"}</td><td className="whitespace-nowrap px-5 text-slate-600">{formatDateTime(log.createdAt)}</td></tr>;
              })}</tbody>
            </table></div>
          </>}</SectionData>
        </section>
        <section className="admin-panel" aria-labelledby="admin-backups">
          <div className="admin-section-heading"><h2 id="admin-backups">Backups</h2></div>
          <div className="space-y-5 p-5"><SectionData query={backupsQuery}>{backups => {
            const latest = backups[0];
            return latest ? <dl className="space-y-4 text-sm"><div><dt className="text-xs text-slate-600">Latest backup status</dt><dd className="mt-1 font-medium">{formatAdminBackupStatus(latest.status)}</dd></div><div><dt className="text-xs text-slate-600">Creation date</dt><dd className="mt-1">{formatDateTime(latest.createdAt)}</dd></div></dl> : <p className="text-sm text-slate-600">No backups yet. Create a copy of recruitment data before you need to recover it.</p>;
          }}</SectionData><Link to="/admin/maintenance" className="admin-section-link inline-flex min-h-11 items-center">View backups</Link></div>
        </section>
      </div>
      <section className="admin-panel" aria-labelledby="admin-matching-weights">
        <div className="admin-section-heading flex flex-wrap items-center justify-between gap-3"><div><h2 id="admin-matching-weights">Matching priorities</h2><p className="mt-1 text-xs text-slate-600">How each factor contributes to candidate scores.</p></div><Link to="/admin/scoring" className="admin-section-link">Edit matching settings</Link></div>
        <SectionData query={configQuery}>{config => {
          if (!config) return <p className="p-5 text-sm text-slate-600">Matching priorities are not available.</p>;
          const weights = Array.isArray(config.weights) ? Object.fromEntries(config.weights.map(weight => [weight.dimension, weight.weight])) : config.weights;
          return <dl className="admin-weights">{[
            ["Skills", "SKILLS"], ["Experience", "EXPERIENCE"], ["Location", "LOCATION"], ["Requirements", "COMPLIANCE"], ["Education", "EDUCATION_CERTIFICATIONS"],
          ].map(([label, key]) => <div key={key}><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{weights?.[key as keyof typeof weights] != null ? weights[key as keyof typeof weights] + "%" : "Not available"}</dd></div>)}</dl>;
        }}</SectionData>
      </section>
    </div>
  );
};
