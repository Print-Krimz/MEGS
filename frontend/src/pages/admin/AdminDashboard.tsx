import React from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { PageHeader, ErrorState, EmptyState } from "../../components/common";
import { Button } from "../../components/ui";
import { formatDate, formatDateTime } from "../../lib/utils";
import { formatAdminBackupStatus, formatAdminRole } from "../../lib/admin-copy";
import { formatAction, formatTargetEntity } from "../../lib/utils/audit-formatter";
import { plural } from "../../lib/plural";

function SectionData<T>({ query, subject, children }: { query: UseQueryResult<T>; subject: string; children: (data: T) => React.ReactNode }) {
  if (query.isError) return <ErrorState compact subject={subject} error={query.error as Error} onRetry={() => { void query.refetch(); }} />;
  if (query.isPending) return <div role="status" aria-label="Loading section" className="space-y-3 p-3.5 motion-safe:animate-pulse"><div className="h-4 w-1/2 bg-slate-200" /><div className="h-3 w-3/4 bg-slate-100" /><span className="sr-only">Loading information</span></div>;
  return <>{children(query.data)}</>;
}

// Tile value: skeleton while pending, "—" plus retry on failure, never a made-up value.
function MetricValue<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => React.ReactNode }) {
  if (query.isPending) return <div role="status" aria-label="Loading metric" className="mt-1 h-8 w-20 bg-slate-200 motion-safe:animate-pulse" />;
  if (query.isError) {
    return (
      <div className="mt-1 flex h-9 items-center gap-2">
        <span className="text-2xl font-semibold text-slate-500" aria-hidden="true">—</span>
        <span className="sr-only">Unavailable</span>
        <button type="button" onClick={() => { void query.refetch(); }} className="focus-ring relative z-10 min-h-11 px-1 text-xs font-medium text-slate-900 underline md:min-h-0">
          Try again
        </button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

/** One headline number, same anatomy as the TA overview tiles. The label link covers the tile. */
const MetricTile: React.FC<{ label: string; to: string; search?: Record<string, string>; children: React.ReactNode }> = ({ label, to, search, children }) => (
  <div className="relative bg-white p-3.5 transition-colors hover:bg-slate-50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-inset has-[a:focus-visible]:ring-focus">
    <Link to={to} search={search as never} className="text-xs font-medium text-slate-600 outline-none after:absolute after:inset-0 after:content-['']">
      {label}
    </Link>
    {children}
  </div>
);

// Dates are longer than counts, so they step down a size to stay on one line in a half-width tile.
const Value: React.FC<{ children: React.ReactNode; tone?: "default" | "alert"; date?: boolean }> = ({ children, tone = "default", date = false }) => (
  <div className={`mt-1 font-display font-semibold tabular-nums whitespace-nowrap ${date ? "text-lg leading-8 sm:text-2xl md:leading-9" : "text-2xl leading-8 md:text-[2rem] md:leading-9"} ${tone === "alert" ? "text-rose-700" : "text-slate-950"}`}>{children}</div>
);

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="mt-1 text-xs text-slate-600">{children}</div>;

const PanelHeader: React.FC<{ id: string; title: string; action?: React.ReactNode }> = ({ id, title, action }) => (
  <div className="flex min-h-12 items-center justify-between gap-2 border-b border-slate-300 bg-slate-100 px-3.5 py-1.5">
    <h2 id={id} className="text-sm font-semibold text-slate-950">{title}</h2>
    {action}
  </div>
);

const WEIGHT_LABELS = [
  ["Skills", "SKILLS"], ["Experience", "EXPERIENCE"], ["Location", "LOCATION"], ["Requirements", "COMPLIANCE"], ["Education", "EDUCATION_CERTIFICATIONS"],
] as const;

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
    <div className="space-y-5">
      <PageHeader title="Overview" flush
        breadcrumbs={[{ label: "Administration" }]}
        actions={<>
          <Button asChild variant="secondary"><Link to="/admin/analytics">View reports</Link></Button>
          <Button asChild><Link to="/admin/users">Manage users</Link></Button>
        </>} />

      <section aria-labelledby="admin-needs-attention" className="space-y-2">
        <h2 id="admin-needs-attention" className="text-sm font-semibold text-slate-950">Needs attention</h2>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300 sm:grid-cols-3">
          <MetricTile label="Invitations" to="/admin/users" search={{ status: "invited" }}>
            <MetricValue query={userSummaryQuery}>{users => <><Value tone={users.expiredInvitations > 0 ? "alert" : "default"}>{users.pendingInvitations + users.expiredInvitations}</Value><Caption>{users.pendingInvitations} pending · {users.expiredInvitations} expired</Caption></>}</MetricValue>
          </MetricTile>
          <MetricTile label="Inactive accounts" to="/admin/users" search={{ status: "inactive" }}>
            <MetricValue query={userSummaryQuery}>{users => <><Value>{users.inactiveAccounts}</Value><Caption>Cannot sign in</Caption></>}</MetricValue>
          </MetricTile>
          <MetricTile label="Latest backup" to="/admin/maintenance">
            <MetricValue query={backupsQuery}>{backups => {
              const latest = backups[0];
              if (!latest) return <><Value>—</Value><Caption>No backups yet</Caption></>;
              return <><Value date tone={latest.status === "FAILED" ? "alert" : "default"}>{formatDate(latest.createdAt)}</Value><Caption>{formatAdminBackupStatus(latest.status)}</Caption></>;
            }}</MetricValue>
          </MetricTile>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-slate-300 bg-slate-300 sm:grid-cols-3">
        <MetricTile label="User accounts" to="/admin/users">
          <MetricValue query={userSummaryQuery}>{users => <><Value>{users.totalUsers}</Value><Caption>{plural(users.recruiters, "recruiter")} · {plural(users.administrators, "administrator")}</Caption></>}</MetricValue>
        </MetricTile>
        <MetricTile label="Average match score" to="/admin/scoring/quality">
          <MetricValue query={qualityQuery}>{quality => {
            const scored = quality?.totalCalculated > 0 && quality.averageFitScore != null && Number.isFinite(Number(quality.averageFitScore));
            return <><Value>{scored ? Number(quality.averageFitScore).toFixed(1) + "%" : "—"}</Value><Caption>{quality?.totalCalculated ? plural(quality.totalCalculated, "candidate") + " scored" : "No candidates scored yet"}</Caption></>;
          }}</MetricValue>
        </MetricTile>
        <MetricTile label="Matching settings" to="/admin/scoring">
          <MetricValue query={configQuery}>{config => <><Value date>{config?.activatedAt ? formatDate(config.activatedAt) : "—"}</Value><Caption>{!config ? "Not available" : config.status === "ACTIVE" ? "Last updated" : "Not in use"}</Caption></>}</MetricValue>
        </MetricTile>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <section aria-labelledby="admin-recent-activity" className="overflow-hidden rounded-md border border-slate-300 bg-white">
          <PanelHeader id="admin-recent-activity" title="Recent activity"
            action={<Button asChild variant="ghost" size="sm"><Link to="/admin/audit">View all</Link></Button>} />
          <SectionData query={auditQuery} subject="recent activity">{logs => logs.length === 0
            ? <EmptyState title="No recent activity" description="Account and system changes will appear here." />
            : <ul className="divide-y divide-slate-200">{logs.map(log => {
              const target = formatTargetEntity(log);
              const who = log.user?.email || (log.user ? formatAdminRole(log.user.role) : "System");
              return <li key={log.id} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{formatAction(log.action)}</p>
                  <p className="break-words text-xs text-slate-600">{target.label}{target.secondary ? " · " + target.secondary : ""}</p>
                  <p className="truncate text-xs text-slate-600" title={who}>By {who}</p>
                </div>
                <time dateTime={log.createdAt} className="shrink-0 whitespace-nowrap text-xs text-slate-600 tabular-nums">{formatDateTime(log.createdAt)}</time>
              </li>;
            })}</ul>}
          </SectionData>
        </section>

        <section aria-labelledby="admin-matching-weights" className="overflow-hidden rounded-md border border-slate-300 bg-white">
          <PanelHeader id="admin-matching-weights" title="Matching priorities"
            action={<Button asChild variant="ghost" size="sm"><Link to="/admin/scoring">Edit</Link></Button>} />
          <SectionData query={configQuery} subject="matching priorities">{config => {
            if (!config) return <p className="p-3.5 text-sm text-slate-600">Matching priorities are not available.</p>;
            const weights = Array.isArray(config.weights) ? Object.fromEntries(config.weights.map(weight => [weight.dimension, weight.weight])) : config.weights;
            return <dl className="divide-y divide-slate-200">{WEIGHT_LABELS.map(([label, key]) => {
              const value = weights?.[key as keyof typeof weights];
              return <div key={key} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                <dt className="text-slate-700">{label}</dt>
                <dd className="font-semibold tabular-nums text-slate-950">{value != null ? value + "%" : "—"}</dd>
              </div>;
            })}</dl>;
          }}</SectionData>
        </section>
      </div>
    </div>
  );
};
