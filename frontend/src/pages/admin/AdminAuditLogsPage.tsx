import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch,
  Search,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Code2,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { adminApi } from '../../lib/api/admin';
import type { AuditLog } from '../../lib/types/api';

const ENTITY_OPTIONS = [
  { value: 'ALL', label: 'All Entities' },
  { value: 'USER', label: 'User / Account' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'JOB_POSTING', label: 'Job Posting' },
  { value: 'SCORING_CONFIG', label: 'Scoring Config' },
  { value: 'DEPLOYMENT', label: 'Deployment' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'MRF', label: 'Manpower Request' },
];

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'All Actions' },
  { value: 'LOGIN', label: 'User Login' },
  { value: 'INVITED_TA', label: 'Invite TA Staff' },
  { value: 'STATUS_CHANGE', label: 'Status Update' },
  { value: 'ROLE_CHANGE', label: 'Role Change' },
  { value: 'CONFIG_UPDATE', label: 'Scoring Config Update' },
  { value: 'RESTORE_DEFAULTS', label: 'Restore Defaults' },
  { value: 'REVALIDATE_SCORES', label: 'Trigger Revalidation' },
  { value: 'CREATE', label: 'Entity Creation' },
  { value: 'UPDATE', label: 'Entity Update' },
  { value: 'DELETE', label: 'Entity Deletion' },
];

export default function AdminAuditLogsPage() {
  // Filter & Search states
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Selected Log for Details Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Fetch Audit Logs
  const {
    data: auditRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'audit-logs', 'all'],
    queryFn: () =>
      adminApi.listAuditLogs({
        limit: 200,
      }),
  });

  const allLogs: AuditLog[] = auditRes?.data || [];

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // Entity Filter
      if (selectedEntity !== 'ALL') {
        const normSelected = selectedEntity.replace(/_/g, '').toUpperCase();
        const normEntity = (log.entity || '').replace(/_/g, '').toUpperCase();
        if (!normEntity.includes(normSelected) && !normSelected.includes(normEntity)) {
          return false;
        }
      }

      // Action Filter
      if (selectedAction !== 'ALL') {
        const normSelected = selectedAction.replace(/_/g, '').toUpperCase();
        const normAction = (log.action || '').replace(/_/g, '').toUpperCase();
        if (!normAction.includes(normSelected) && !normSelected.includes(normAction)) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actorEmail = (log.user?.email || log.actor?.email || log.userId || '').toLowerCase();
        const actionStr = (log.action || '').toLowerCase();
        const entityStr = (log.entity || '').toLowerCase();
        const detailsStr =
          typeof log.details === 'string'
            ? log.details.toLowerCase()
            : JSON.stringify(log.details || {}).toLowerCase();
        const entityIdStr = log.entityId ? String(log.entityId) : '';

        if (
          !actorEmail.includes(q) &&
          !actionStr.includes(q) &&
          !entityStr.includes(q) &&
          !detailsStr.includes(q) &&
          !entityIdStr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allLogs, selectedEntity, selectedAction, searchQuery]);

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleCopyJson = () => {
    if (!selectedLog) return;
    const jsonStr = JSON.stringify(selectedLog, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setIsCopied(true);
    toast.success('Audit log JSON copied to clipboard');
    setTimeout(() => setIsCopied(false), 2000);
  };

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
    if (act.includes('CONFIG') || act.includes('WEIGHT') || act.includes('SCORING') || act.includes('REVALIDAT')) {
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

  if (isLoading) {
    return <LoadingState variant="page" />;
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Immutable Audit Trail"
          description="Search, filter, and inspect chronological logs of user logins, role modifications, and recruitment transitions."
          breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Audit Trail' }]}
        />
        <ErrorState
          title="Failed to load audit logs"
          message={error instanceof Error ? error.message : 'Unable to connect to audit log service.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" data-testid="admin-audit-page">
      <PageHeader
        title="Immutable Audit Trail"
        description="Search, filter, and inspect chronological logs of user logins, role modifications, and recruitment transitions."
        breadcrumbs={[{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Audit Trail' }]}
      />

      {/* Filter and Search Controls */}
      <div className="bg-card border border-border rounded-xl shadow-subtle p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Entity Filter */}
          <div className="space-y-1.5">
            <label htmlFor="audit-entity-filter-select" className="text-xs font-mono font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Entity Filter
            </label>
            <select
              id="audit-entity-filter-select"
              data-testid="audit-entity-filter"
              aria-label="Filter audit logs by target entity type"
              value={selectedEntity}
              onChange={(e) => {
                setSelectedEntity(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:ring-2 focus:ring-slate-400"
            >
              {ENTITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="space-y-1.5">
            <label htmlFor="audit-action-filter-select" className="text-xs font-mono font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Action Filter
            </label>
            <select
              id="audit-action-filter-select"
              data-testid="audit-action-filter"
              aria-label="Filter audit logs by action category"
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:ring-2 focus:ring-slate-400"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <label htmlFor="audit-search-input" className="text-xs font-mono font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" /> Keyword Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="audit-search-input"
                type="text"
                data-testid="audit-search-input"
                placeholder="Search actor, action, details..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-3.5 bg-background border border-border rounded-lg text-sm font-medium text-foreground focus:ring-2 focus:ring-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-card border border-border rounded-xl shadow-subtle overflow-hidden" data-testid="audit-table-container">
        {paginatedLogs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <FileSearch className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No audit logs found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No recorded system events match your search or filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="audit-logs-table">
              <thead className="bg-slate-50 border-b border-border text-slate-500 font-semibold uppercase tracking-wider font-mono text-xs">
                <tr>
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-5">Actor</th>
                  <th className="py-3.5 px-5">Action</th>
                  <th className="py-3.5 px-5">Target Entity</th>
                  <th className="py-3.5 px-5">Summary</th>
                  <th className="py-3.5 px-5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedLogs.map((log) => {
                  const actorEmail = log.user?.email || log.actor?.email || log.userId || 'System';
                  const actorRole = log.user?.role || log.actor?.role || 'SYSTEM';
                  const entityText = log.entity ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ''}` : '—';
                  const detailsText =
                    typeof log.details === 'string'
                      ? log.details
                      : log.details
                      ? JSON.stringify(log.details)
                      : '—';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`audit-row-${log.id}`}>
                      {/* Timestamp */}
                      <td className="py-4 px-5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatTimestamp(log.createdAt || log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {actorEmail.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{actorEmail}</div>
                            <div className="text-xs text-muted-foreground font-mono">{actorRole}</div>
                          </div>
                        </div>
                      </td>

                      {/* Action Pill */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono font-semibold border ${getActionTagColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="py-4 px-5 font-mono text-xs text-slate-700 whitespace-nowrap font-medium">
                        {entityText}
                      </td>

                      {/* Summary */}
                      <td className="py-4 px-5 text-xs text-muted-foreground truncate max-w-xs" title={detailsText}>
                        {detailsText}
                      </td>

                      {/* View Details Action */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          data-testid="audit-view-details-btn"
                          className="h-[34px] px-3.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg inline-flex items-center gap-1.5 transition duration-150 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Payload</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-semibold text-foreground">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{' '}
              of <span className="font-semibold text-foreground">{totalItems}</span> events
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-xs px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition duration-150 inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* JSON Payload Details Modal */}
      {selectedLog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
          data-testid="audit-details-modal"
        >
          <div className="w-full max-w-2xl bg-card rounded-xl border border-border shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="audit-modal-title" className="text-base font-bold text-foreground">
                    Audit Event Payload &middot; #{selectedLog.id}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Action: <span className="font-bold text-foreground">{selectedLog.action}</span> &middot;{' '}
                    {formatTimestamp(selectedLog.createdAt || selectedLog.timestamp)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyJson}
                  className="h-9 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg inline-flex items-center gap-1.5 transition duration-150 cursor-pointer"
                  title="Copy formatted JSON payload"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => setSelectedLog(null)}
                  data-testid="close-audit-details-btn"
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content / JSON Pre block */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Actor</div>
                  <div className="font-semibold text-slate-900 truncate mt-1 text-xs">
                    {selectedLog.user?.email || selectedLog.actor?.email || selectedLog.userId || 'System'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Action</div>
                  <div className="font-semibold text-slate-900 truncate mt-1 text-xs">{selectedLog.action}</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Entity</div>
                  <div className="font-semibold text-slate-900 truncate mt-1 text-xs">
                    {selectedLog.entity || 'N/A'} {selectedLog.entityId ? `#${selectedLog.entityId}` : ''}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-xs text-muted-foreground uppercase font-semibold">IP Address</div>
                  <div className="font-semibold font-mono text-slate-900 truncate mt-1 text-xs">
                    {selectedLog.ipAddress || '127.0.0.1'}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 font-mono">
                  Raw JSON Event Record
                </div>
                <pre
                  data-testid="audit-json-payload"
                  className="bg-slate-900 text-slate-100 font-mono text-xs p-4 rounded-xl overflow-x-auto leading-normal border border-slate-800 shadow-inner max-h-96"
                >
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="h-9 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition duration-150 cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
