import React, { useState, useMemo } from "react";
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
  Calendar,
  User as UserIcon,
  Globe,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import {
  ACTION_LABELS,
  AUDIT_CATEGORIES,
  formatAction,
  getActionCategory,
  getCategoryBadgeClass,
  formatIpAddress,
  formatTargetEntity,
  extractDisplayDetails,
  parseDetails,
} from "../../lib/utils/audit-formatter";
import type { AuditLog } from "../../lib/types/admin.types";

export const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Compute effective start and end dates based on preset or custom pickers
  const effectiveDates = useMemo(() => {
    if (datePreset === "CUSTOM") {
      return { startDate: startDate || undefined, endDate: endDate || undefined };
    }
    const now = new Date();
    if (datePreset === "TODAY") {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { startDate: today.toISOString() };
    }
    if (datePreset === "7D") {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: d.toISOString() };
    }
    if (datePreset === "30D") {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: d.toISOString() };
    }
    return { startDate: undefined, endDate: undefined };
  }, [datePreset, startDate, endDate]);

  const auditLogsQuery = useQuery({
    queryKey: [
      "admin",
      "audit",
      filterValues.category,
      filterValues.action,
      effectiveDates.startDate,
      effectiveDates.endDate,
    ],
    queryFn: () =>
      adminApi.listAuditLogs({
        action: filterValues.action || undefined,
        category: filterValues.category || undefined,
        startDate: effectiveDates.startDate,
        endDate: effectiveDates.endDate,
        limit: 300,
      }),
  });

  const allLogs: AuditLog[] = auditLogsQuery.data || [];

  // Client-side quick filter for fast text search across formatted actions, actors, and details
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const rawAction = (log.action || "").toLowerCase();
      const formattedAct = formatAction(log.action).toLowerCase();
      const actorEmail = (log.user?.email || log.userId || "").toLowerCase();
      const actorName = log.user?.applicantProfile
        ? `${log.user.applicantProfile.firstName || ""} ${log.user.applicantProfile.lastName || ""}`.toLowerCase()
        : "";
      const entityFormatted = formatTargetEntity(log);
      const entityStr = `${entityFormatted.type} ${entityFormatted.label} ${entityFormatted.secondary || ""}`.toLowerCase();
      const detailsStr = (typeof log.details === "string" ? log.details : JSON.stringify(log.details || {})).toLowerCase();

      return (
        rawAction.includes(q) ||
        formattedAct.includes(q) ||
        actorEmail.includes(q) ||
        actorName.includes(q) ||
        entityStr.includes(q) ||
        detailsStr.includes(q)
      );
    });
  }, [allLogs, search]);

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

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    if (preset !== "CUSTOM") {
      setStartDate("");
      setEndDate("");
    }
    setPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setFilterValues({});
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Build list of action options grouped or formatted
  const actionFilterOptions = useMemo(() => {
    return Object.entries(ACTION_LABELS).map(([value, label]) => ({
      value,
      label,
    }));
  }, []);

  const categoryFilterOptions = useMemo(() => {
    return AUDIT_CATEGORIES.map((cat) => ({
      value: cat,
      label: cat,
    }));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Immutable, tamper-evident audit ledger capturing authentication events, role modifications, recruitment decisions, and configuration changes."
        breadcrumbs={[
          { label: "Admin Operations", href: "/admin" },
          { label: "Audit Logs" },
        ]}
      />

      {/* Main Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search actor, action, applicant, job, or details..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "category",
            label: "Category",
            placeholder: "All Audit Categories",
            options: categoryFilterOptions,
          },
          {
            key: "action",
            label: "Action Type",
            placeholder: "All Action Types",
            options: actionFilterOptions,
          },
        ]}
      />

      {/* Date Range Toolbar */}
      <div className="bg-white p-3 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono uppercase text-[11px] font-bold text-slate-600 flex items-center gap-1.5 mr-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            Date Range:
          </span>

          <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-100">
            {[
              { id: "ALL", label: "All Time" },
              { id: "TODAY", label: "Today" },
              { id: "7D", label: "Last 7 Days" },
              { id: "30D", label: "Last 30 Days" },
              { id: "CUSTOM", label: "Custom Range" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors rounded-sm ${
                  datePreset === p.id
                    ? "bg-teal-700 text-white shadow-xs font-semibold"
                    : "text-slate-700 hover:text-slate-950 hover:bg-slate-200/60"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {datePreset === "CUSTOM" && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-300">
              <label className="text-slate-500 text-[11px]">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 border border-slate-300 bg-white text-slate-800 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <label className="text-slate-500 text-[11px]">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 border border-slate-300 bg-white text-slate-800 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          Showing <span className="font-bold text-slate-900">{filteredLogs.length}</span> recorded events
        </div>
      </div>

      {/* Logs Table */}
      {auditLogsQuery.isLoading ? (
        <LoadingState variant="table" rows={8} />
      ) : auditLogsQuery.isError ? (
        <ErrorState error={auditLogsQuery.error} onRetry={() => auditLogsQuery.refetch()} />
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-300 p-8 text-center">
          <EmptyState
            icon={<Shield className="w-6 h-6 text-slate-400" />}
            title="No Audit Logs Found"
            description="No system audit trail events matched your search terms or filter criteria."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset All Filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-300 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-mono uppercase text-[10px] border-b border-slate-300">
                <tr>
                  <th className="px-4 py-3 font-bold">Event Action</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Actor / User</th>
                  <th className="px-4 py-3 font-bold">Target Entity</th>
                  <th className="px-4 py-3 font-bold">Timestamp</th>
                  <th className="px-4 py-3 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedLogs.map((log) => {
                  const category = getActionCategory(log.action);
                  const formattedAct = formatAction(log.action);
                  const targetEntity = formatTargetEntity(log);
                  const actorEmail = log.user?.email || log.userId || "System Service";
                  const actorRole = log.user?.role;
                  const isFailedAction =
                    log.action.includes("FAIL") ||
                    log.action.includes("REJECT") ||
                    log.action.includes("DECLINED") ||
                    log.action.includes("DEACTIVATED");

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      {/* Action */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-950 font-sans text-xs flex items-center gap-1.5">
                          {isFailedAction ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 shrink-0" />
                          )}
                          <span>{formattedAct}</span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-mono uppercase font-bold tracking-wider rounded-sm border ${getCategoryBadgeClass(
                            category
                          )}`}
                        >
                          {category}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-medium text-xs">
                            {actorEmail}
                          </span>
                          {actorRole && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {actorRole.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Target Entity */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-900 font-medium text-xs">
                            {targetEntity.label}
                          </span>
                          {targetEntity.secondary && (
                            <span className="text-[11px] text-slate-500">
                              {targetEntity.secondary}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 text-slate-500 text-[11px] font-mono whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>

                      {/* Details Button */}
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5 text-teal-700" />}
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-slate-100 text-teal-800 font-medium"
                        >
                          View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
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

      {/* Redesigned Audit Event Details Modal */}
      {selectedLog && (
        <Dialog
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title="Audit Event Details"
          description={`Audit Record #${selectedLog.id} • ${formatAction(selectedLog.action)}`}
        >
          <div className="space-y-5">
            {/* Modal Header Card */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold tracking-wider rounded-sm border ${getCategoryBadgeClass(
                      getActionCategory(selectedLog.action)
                    )}`}
                  >
                    {getActionCategory(selectedLog.action)}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {formatAction(selectedLog.action)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateTime(selectedLog.createdAt)}</span>
                </div>
              </div>

              {/* Primary Overview Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 text-xs">
                {/* Performed By */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                    <UserIcon className="w-3 h-3 text-slate-400" />
                    Actor / User
                  </div>
                  <div className="font-semibold text-slate-900">
                    {selectedLog.user?.email || selectedLog.userId || "System Service"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Role: {selectedLog.user?.role?.replace(/_/g, " ") || "Automated Process"}
                  </div>
                </div>

                {/* Target Entity */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-slate-400" />
                    Target Entity
                  </div>
                  {(() => {
                    const entity = formatTargetEntity(selectedLog);
                    return (
                      <>
                        <div className="font-semibold text-slate-900">{entity.label}</div>
                        <div className="text-[11px] text-slate-500">
                          {entity.type}
                          {entity.secondary ? ` • ${entity.secondary}` : ""}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* IP Address */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-slate-400" />
                    IP Address
                  </div>
                  <div className="font-mono text-slate-800">
                    {formatIpAddress(selectedLog.ipAddress || parseDetails(selectedLog.details).ip)}
                  </div>
                </div>

                {/* Result */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-slate-400" />
                    Result / Outcome
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    {selectedLog.action.includes("FAIL") || selectedLog.action.includes("DEACTIVATED") ? (
                      <span className="inline-flex items-center gap-1 text-rose-700 text-xs font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Alert / Action Logged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Successful
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Event Details & Context */}
            {(() => {
              const displayItems = extractDisplayDetails(selectedLog);
              if (displayItems.length === 0) return null;
              return (
                <div className="border border-slate-200 p-3.5 bg-white">
                  <h4 className="text-[11px] font-mono uppercase tracking-wider font-bold text-slate-700 mb-2.5 pb-1 border-b border-slate-100">
                    Event Context & Metadata
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {displayItems.map((item, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 border border-slate-200/60 rounded-xs">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
                          {item.label}
                        </div>
                        <div className="text-slate-900 font-medium break-words">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

