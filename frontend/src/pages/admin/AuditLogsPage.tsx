import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import {
  Shield,
  Eye,
} from "lucide-react";

export const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const auditLogsQuery = useQuery({
    queryKey: ["admin", "audit", filterValues],
    queryFn: () =>
      adminApi.listAuditLogs({
        action: filterValues.action || undefined,
        entity: filterValues.entity || undefined,
        limit: 200,
      }),
  });

  const allLogs = auditLogsQuery.data || [];

  const filteredLogs = allLogs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const actionMatch = (log.action || "").toLowerCase().includes(q);
    const actorMatch = (log.user?.email || log.userId || "").toLowerCase().includes(q);
    const entityMatch = (log.entity || "").toLowerCase().includes(q);
    return actionMatch || actorMatch || entityMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Administrative Audit Logs"
        description="Immutable system-wide audit trail for compliance verification and administrative action tracking"
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Audit Logs" },
        ]}
      />

      {/* Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search actor email, action, or entity..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "action",
            label: "Action Type",
            options: [
              { value: "USER_INVITED", label: "USER INVITED" },
              { value: "USER_ROLE_UPDATED", label: "USER ROLE UPDATED" },
              { value: "USER_STATUS_UPDATED", label: "USER STATUS UPDATED" },
              { value: "SCORING_CONFIG_ACTIVATED", label: "SCORING CONFIG ACTIVATED" },
              { value: "SCORING_DEFAULTS_RESTORED", label: "SCORING DEFAULTS RESTORED" },
            ],
          },
          {
            key: "entity",
            label: "Entity Scope",
            options: [
              { value: "User", label: "User Accounts" },
              { value: "CandidateScoringConfiguration", label: "Scoring Configuration" },
              { value: "Application", label: "Applications" },
            ],
          },
        ]}
      />

      {/* Logs Table */}
      {auditLogsQuery.isLoading ? (
        <LoadingState variant="table" rows={8} />
      ) : auditLogsQuery.isError ? (
        <ErrorState error={auditLogsQuery.error} onRetry={() => auditLogsQuery.refetch()} />
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-300 p-6">
          <EmptyState
            icon={<Shield className="w-5 h-5" />}
            title="No Audit Logs Found"
            description="No audit trail events matched your search or action filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5 font-bold">Event Action</th>
                  <th className="px-3.5 py-2.5 font-bold">Actor / User</th>
                  <th className="px-3.5 py-2.5 font-bold">Target Entity</th>
                  <th className="px-3.5 py-2.5 font-bold">Timestamp</th>
                  <th className="px-3.5 py-2.5 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-100/70 transition-colors">
                    <td className="px-3.5 py-2.5 font-bold text-slate-950">
                      {log.action}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700 font-sans">
                      {log.user?.email || log.userId || "System Service"}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {log.entity ? `${log.entity} #${log.entityId || ""}` : "Global"}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 text-[11px]">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-sans">
                      {log.details ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedLog(log)}
                        >
                          View Details
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-slate-300 bg-slate-50">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Details"
        description={`Audit record #${selectedLog?.id} • Action: ${selectedLog?.action}`}
      >
        <div className="space-y-4">
          <div className="bg-slate-900 text-teal-300 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-80">
            <pre>
              {selectedLog?.details
                ? typeof selectedLog.details === "string"
                  ? (() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                      } catch {
                        return selectedLog.details;
                      }
                    })()
                  : JSON.stringify(selectedLog.details, null, 2)
                : "{}"}
            </pre>
          </div>
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
