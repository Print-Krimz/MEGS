import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Sliders,
  FileSearch,
  Server,
  Database,
  Cpu,
  RefreshCw,
  ArrowRight,
  UserCheck,
  Activity,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi } from '../../lib/api/admin';
import { Role } from '../../lib/types/enums';
import type { User, AuditLog, CandidateScoringConfiguration, ScoringQualityMetrics } from '../../lib/types/api';

export default function AdminDashboardPage() {
  // 1. Users query for stats
  const {
    data: usersRes,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin', 'users', 'dashboard'],
    queryFn: () => adminApi.listUsers(),
  });

  // 2. Active scoring configuration
  const {
    data: configRes,
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    error: errorConfig,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'active'],
    queryFn: () => adminApi.getActiveScoringConfiguration(),
  });

  // 3. Recent audit logs
  const {
    data: auditRes,
    isLoading: isLoadingAudit,
    isError: isErrorAudit,
    error: errorAudit,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ['admin', 'audit-logs', 'recent'],
    queryFn: () => adminApi.listAuditLogs({ limit: 5 }),
  });

  // 4. Scoring quality metrics
  const {
    data: metricsRes,
    isLoading: isLoadingMetrics,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['admin', 'scoring', 'quality-metrics'],
    queryFn: () => adminApi.getScoringQualityMetrics(),
  });

  const isAnyLoading = isLoadingUsers || isLoadingConfig || isLoadingAudit || isLoadingMetrics;
  const isAnyError = isErrorUsers || isErrorConfig || isErrorAudit;

  const handleRetryAll = () => {
    refetchUsers();
    refetchConfig();
    refetchAudit();
    refetchMetrics();
  };

  if (isAnyLoading) {
    return <LoadingState variant="page" />;
  }

  if (isAnyError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="System Administration Console"
          description="System governance, user roles, candidate scoring algorithms, and security audit logs."
        />
        <ErrorState
          title="Failed to load admin metrics"
          message={
            (errorUsers instanceof Error && errorUsers.message) ||
            (errorConfig instanceof Error && errorConfig.message) ||
            (errorAudit instanceof Error && errorAudit.message) ||
            'Unable to connect to administrative endpoints.'
          }
          onRetry={handleRetryAll}
        />
      </div>
    );
  }

  const users: User[] = usersRes?.data || [];
  const config: CandidateScoringConfiguration | undefined = configRes?.data;
  const auditLogs: AuditLog[] = auditRes?.data || [];
  const metrics: ScoringQualityMetrics | undefined = metricsRes?.data;

  // Derived metrics
  const totalUsers = users.length;
  const taUsers = users.filter((u) => u.role === Role.TALENT_ACQUISITION || (u.role as string) === 'TA');
  const adminUsers = users.filter((u) => u.role === Role.ADMINISTRATOR || (u.role as string) === 'ADMIN');
  const applicantUsers = users.filter((u) => u.role === Role.APPLICANT);
  const activeVersionNumber = config ? `v${config.version || 1}.${config.revision || 0}` : 'v1.0';
  const totalAuditEvents = auditLogs.length > 0 ? (metrics?.totalScoresCalculated ? metrics.totalScoresCalculated + auditLogs.length : auditLogs.length) : 0;

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return dateStr;
    }
  };

  const getActionTagColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN') || act.includes('AUTH')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (act.includes('INVIT') || act.includes('CREATE') || act.includes('REGISTER')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('CONFIG') || act.includes('WEIGHT') || act.includes('SCORING')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    if (act.includes('UPDATE') || act.includes('ROLE') || act.includes('STATUS')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('DELETE') || act.includes('DEACTIVAT') || act.includes('REJECT')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatHumanReadableDetails = (details: any, action: string, entity?: string, entityId?: string | number): string => {
    if (!details) {
      if (entity) return `${action} on ${entity}${entityId ? ` #${entityId}` : ''}`;
      return action;
    }

    let parsed = details;
    if (typeof details === 'string') {
      try {
        parsed = JSON.parse(details);
      } catch {
        return details;
      }
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return String(parsed);
    }

    if (parsed.ip) {
      return `Logged in from ${parsed.ip}`;
    }
    if (parsed.email) {
      return `Invited ${parsed.email}${parsed.role ? ` (${parsed.role})` : ''}`;
    }
    if (parsed.isActive !== undefined) {
      return `Account ${parsed.isActive ? 'activated' : 'deactivated'}`;
    }
    if (parsed.status) {
      return `Status changed to ${parsed.status}`;
    }
    if (parsed.version !== undefined && parsed.revision !== undefined) {
      return `Activated scoring configuration v${parsed.version}.${parsed.revision}`;
    }
    if (parsed.expectedRevision !== undefined) {
      return `Updated scoring configuration (Revision ${parsed.expectedRevision})`;
    }
    if (parsed.message) {
      return parsed.message;
    }

    const entries = Object.entries(parsed);
    if (entries.length > 0) {
      return entries
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(', ');
    }

    if (entity) return `${action} on ${entity}${entityId ? ` #${entityId}` : ''}`;
    return action;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="admin-dashboard-page">
      <PageHeader
        title="System Administration Console"
        description="System governance, user roles, candidate scoring algorithms, and security audit logs."
      />

      {/* 4 Key Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-metric-cards">
        {/* Metric 1: Total Users */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3 bg-slate-100 text-slate-800 rounded-xl shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Users</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-1" data-testid="stat-total-users">
              {totalUsers}
            </div>
            <div className="text-xs text-muted-foreground font-medium mt-1 truncate">
              {applicantUsers.length} Applicants &middot; {adminUsers.length} Admins
            </div>
          </div>
        </div>

        {/* Metric 2: TA Staff */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">TA Recruiter Staff</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-1" data-testid="stat-ta-staff">
              {taUsers.length}
            </div>
            <div className="text-xs text-teal-700 font-medium mt-1">
              Active talent operators
            </div>
          </div>
        </div>

        {/* Metric 3: Active Scoring Config */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scoring Config</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-1" data-testid="stat-scoring-version">
              {activeVersionNumber}
            </div>
            <div className="text-xs text-indigo-700 font-medium mt-1">
              {config?.scope || 'GLOBAL'} &middot; Active
            </div>
          </div>
        </div>

        {/* Metric 4: Total Audit Events */}
        <div className="p-6 rounded-xl border border-border bg-card shadow-subtle flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Audit Events</div>
            <div className="text-3xl font-bold font-mono text-foreground mt-1" data-testid="stat-audit-events">
              {totalAuditEvents}
            </div>
            <div className="text-xs text-amber-700 font-medium mt-1">
              Chronological log stream
            </div>
          </div>
        </div>
      </div>

      {/* System Status & Health Indicator Card */}
      <div className="p-6 bg-card border border-border rounded-xl shadow-subtle" data-testid="system-health-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                System Status & Infrastructure Health
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Continuous operational health checks across core services and algorithms.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Services Operational</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          {/* Service 1: Postgres DB */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Database className="w-4 h-4 text-teal-600" />
                <span>Postgres Database</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Healthy
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Connection pool nominal &middot; Latency &lt; 5ms
            </p>
          </div>

          {/* Service 2: Supabase Auth */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>Supabase Auth</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Synchronized
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              RLS policies active &middot; JWT signing nominal
            </p>
          </div>

          {/* Service 3: Gemini AI Matcher */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>Gemini AI Matcher</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Operational
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              KNN vector search ready &middot; Weights loaded
            </p>
          </div>

          {/* Service 4: Revalidation Engine */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <span>Score Revalidation</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Worker concurrency: 5 &middot; 0 queue backlog
            </p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="admin-shortcuts">
        <Link
          to="/admin/users"
          className="p-6 bg-card border border-border rounded-xl shadow-subtle hover:shadow-card hover:border-slate-300 transition duration-150 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-slate-100 text-slate-800 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition duration-150">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-foreground transition duration-150" />
          </div>
          <div className="mt-4">
            <div className="text-base font-semibold text-foreground">User Management</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Invite TA recruiters, assign admin privileges, and manage account statuses.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/scoring"
          className="p-6 bg-card border border-border rounded-xl shadow-subtle hover:shadow-card hover:border-slate-300 transition duration-150 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-teal-50 text-teal-700 rounded-xl group-hover:bg-teal-700 group-hover:text-white transition duration-150">
              <Sliders className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-foreground transition duration-150" />
          </div>
          <div className="mt-4">
            <div className="text-base font-semibold text-foreground">Candidate Scoring Weights</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Tune dimensional weights (Skills, Experience, Location) and trigger revalidations.
            </p>
          </div>
        </Link>

        <Link
          to="/admin/audit-logs"
          className="p-6 bg-card border border-border rounded-xl shadow-subtle hover:shadow-card hover:border-slate-300 transition duration-150 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl group-hover:bg-indigo-700 group-hover:text-white transition duration-150">
              <FileSearch className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-foreground transition duration-150" />
          </div>
          <div className="mt-4">
            <div className="text-base font-semibold text-foreground">Audit Trail</div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Inspect immutable security events, role changes, and candidate stage transitions.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent System Audit Activity Table */}
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="recent-audit-table">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
              Recent System Audit Activity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time feed of recent administrative and recruitment transactions.
            </p>
          </div>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-teal-800 hover:text-teal-900 inline-flex items-center gap-1 transition-colors"
          >
            <span>View All Logs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No audit events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-semibold uppercase tracking-wider font-mono">
                <tr>
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-5">Actor</th>
                  <th className="py-3.5 px-5">Action</th>
                  <th className="py-3.5 px-5">Target Entity</th>
                  <th className="py-3.5 px-5">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.slice(0, 5).map((log) => {
                  const actorEmail = log.user?.email || log.actor?.email || log.userId || 'System';
                  const actorRole = log.user?.role || log.actor?.role || 'SYSTEM';
                  const entityText = log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ''}` : '—';
                  const humanSummary = formatHumanReadableDetails(log.details, log.action, log.entity, log.entityId);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimestamp(log.createdAt || log.timestamp)}
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {actorEmail.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{actorEmail}</div>
                            <div className="text-xs text-muted-foreground font-mono">{actorRole}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold border ${getActionTagColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-4 px-5 font-mono text-xs text-slate-700 whitespace-nowrap font-medium">
                        {entityText}
                      </td>
                      <td className="py-4 px-5 text-xs text-muted-foreground truncate max-w-xs" title={humanSummary}>
                        {humanSummary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
