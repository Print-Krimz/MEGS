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
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert,
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
  formatActor,
  getAuditSeverity,
  getAuditSeverityBadgeClass,
  getAuditExplanation,
} from "../../lib/utils/audit-formatter";
import type { AuditLog } from "../../lib/types/admin.types";

export const AuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

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
        limit: 500,
      }),
  });

  const allLogs: AuditLog[] = auditLogsQuery.data || [];

  // Summary Metrics
  const summaryStats = useMemo(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let recruitmentCount = 0;
    let configCount = 0;

    for (const log of allLogs) {
      const sev = getAuditSeverity(log);
      if (sev === "CRITICAL") criticalCount++;
      else if (sev === "WARNING") warningCount++;

      const cat = getActionCategory(log.action);
      if (cat === "Recruitment" || cat === "Deployment" || cat === "Compliance") {
        recruitmentCount++;
      } else if (cat === "Configuration" || cat === "Security") {
        configCount++;
      }
    }

    return {
      total: allLogs.length,
      securityAttention: criticalCount + warningCount,
      recruitment: recruitmentCount,
      configuration: configCount,
    };
  }, [allLogs]);

  // Client-side quick filter for fast text search & severity filter
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      // 1. Severity filter
      if (severityFilter !== "ALL") {
        const sev = getAuditSeverity(log);
        if (sev !== severityFilter) return false;
      }

      // 2. Text Search
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
  }, [allLogs, search, severityFilter]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page, pageSize]);

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
    setSeverityFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const handleExportPDF = async () => {
    try {
      setIsExportingPdf(true);
      const blob = await adminApi.exportAuditReport("pdf", {
        action: filterValues.action,
        category: filterValues.category,
        search: search || undefined,
        startDate: effectiveDates.startDate,
        endDate: effectiveDates.endDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `megs-security-audit-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err?.message || "Failed to export PDF audit report");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setIsExportingCsv(true);
      const blob = await adminApi.exportAuditReport("csv", {
        action: filterValues.action,
        category: filterValues.category,
        search: search || undefined,
        startDate: effectiveDates.startDate,
        endDate: effectiveDates.endDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `megs-security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err?.message || "Failed to export CSV audit report");
    } finally {
      setIsExportingCsv(false);
    }
  };

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
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Activity log"
        description="Immutable, tamper-evident security audit trail capturing authentication, role changes, recruitment milestones, and configuration events."
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Activity log" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />}
              onClick={handleExportCSV}
              disabled={isExportingCsv || allLogs.length === 0}
            >
              {isExportingCsv ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5" />}
              onClick={handleExportPDF}
              disabled={isExportingPdf || allLogs.length === 0}
            >
              {isExportingPdf ? "Generating..." : "Export PDF Report"}
            </Button>
          </div>
        }
      />

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Events</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">{summaryStats.total}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Recorded across all modules</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Security & Attention</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">{summaryStats.securityAttention}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Critical or warning findings</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Recruitment Actions</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">{summaryStats.recruitment}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Stage & compliance events</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">System & Recovery</span>
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">{summaryStats.configuration}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Backups & global settings</p>
        </div>
      </div>

      {/* Main Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search event, actor email, candidate, job, or notes..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "category",
            label: "Category",
            placeholder: "All Categories",
            options: categoryFilterOptions,
          },
          {
            key: "action",
            label: "Event Type",
            placeholder: "All Event Types",
            options: actionFilterOptions,
          },
        ]}
      />

      {/* Toolbar: Severity Filter & Date Range Filter */}
      <div className="bg-white p-3 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Severity Quick Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600">Severity:</span>
          <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-100">
            {[
              { id: "ALL", label: "All" },
              { id: "CRITICAL", label: "Critical" },
              { id: "WARNING", label: "Warning" },
              { id: "INFORMATIONAL", label: "Info" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSeverityFilter(s.id);
                  setPage(1);
                }}
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors rounded-xs ${
                  severityFilter === s.id
                    ? "bg-white text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Date:
          </span>

          <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-100">
            {[
              { id: "ALL", label: "All Time" },
              { id: "TODAY", label: "Today" },
              { id: "7D", label: "7 Days" },
              { id: "30D", label: "30 Days" },
              { id: "CUSTOM", label: "Custom" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors rounded-xs ${
                  datePreset === p.id
                    ? "bg-white text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {datePreset === "CUSTOM" && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white"
                aria-label="Start date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white"
                aria-label="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="border border-slate-300 bg-white shadow-xs">
        <div className="px-3.5 py-2.5 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Security & Activity Ledger
            </h3>
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
            Showing {filteredLogs.length} matching events
          </span>
        </div>

        {auditLogsQuery.isLoading ? (
          <LoadingState variant="table" rows={10} />
        ) : auditLogsQuery.isError ? (
          <ErrorState
            error={auditLogsQuery.error}
            onRetry={() => auditLogsQuery.refetch()}
          />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No audit events found"
            description="Try changing your search criteria or resetting filters."
            action={
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-[11px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5">Event & Severity</th>
                  <th className="px-3.5 py-2.5">Category</th>
                  <th className="px-3.5 py-2.5">Actor</th>
                  <th className="px-3.5 py-2.5">Target Subject</th>
                  <th className="px-3.5 py-2.5">Details</th>
                  <th className="px-3.5 py-2.5">IP Address</th>
                  <th className="px-3.5 py-2.5 text-right">Date & Time</th>
                  <th className="px-3.5 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedLogs.map((log) => {
                  const category = getActionCategory(log.action);
                  const severity = getAuditSeverity(log);
                  const formattedAct = formatAction(log.action);
                  const targetEntity = formatTargetEntity(log);
                  const summary = extractDisplayDetails(log);
                  const actor = formatActor(log);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-slate-950 font-sans text-xs">
                            {formattedAct}
                          </span>
                          <span
                            className={`inline-block w-fit px-1.5 py-0.2 text-[9px] font-semibold uppercase rounded-xs border ${getAuditSeverityBadgeClass(
                              severity
                            )}`}
                          >
                            {severity}
                          </span>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-xs border ${getCategoryBadgeClass(
                            category
                          )}`}
                        >
                          {category}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-medium text-slate-900 truncate max-w-[160px]">
                              {actor.name}
                            </span>
                          </div>
                          {actor.role && (
                            <span className="text-[10px] text-slate-500 pl-4">
                              {actor.role}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{targetEntity.label}</span>
                          {targetEntity.secondary && (
                            <span className="text-[10px] text-slate-500">
                              {targetEntity.secondary}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 max-w-[180px] truncate">
                        {Array.isArray(summary) && summary.length > 0
                          ? summary.map((s) => `${s.label}: ${s.value}`).join(" • ")
                          : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatIpAddress(log.ipAddress)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-[11px] text-slate-600 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye className="w-3 h-3 text-slate-600" />}
                          onClick={() => setSelectedLog(log)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredLogs.length > pageSize && (
          <div className="p-3 border-t border-slate-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedLog && (() => {
        const severity = getAuditSeverity(selectedLog);
        const explanation = getAuditExplanation(selectedLog);
        const targetEntity = formatTargetEntity(selectedLog);
        const actor = formatActor(selectedLog);
        // Deduplicate display items if already shown in the Subject row
        const displayItems = extractDisplayDetails(selectedLog).filter((item) => {
          if (item.label === "Candidate" && targetEntity.label === item.value) return false;
          if (item.label === "Position" && targetEntity.secondary === item.value) return false;
          return true;
        });

        return (
          <Dialog
            open={!!selectedLog}
            onClose={() => setSelectedLog(null)}
            title={formatAction(selectedLog.action)}
            description={`Recorded on ${formatDateTime(selectedLog.createdAt)}`}
            size="md"
          >
            <div className="space-y-3 font-sans text-xs">
              {/* Security Alert (Only when critical) */}
              {severity === "CRITICAL" && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs">Security Notice</span>
                    <p className="text-[11px] text-amber-800 leading-normal">
                      {explanation.whyItMatters || "This action involves elevated system privileges or security verification."}
                    </p>
                  </div>
                </div>
              )}

              {/* Single Clean Details Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-sm p-3 divide-y divide-slate-200 text-xs">
                {/* Subject & Candidate */}
                {targetEntity.label && (
                  <div className="py-2 first:pt-0 flex items-start justify-between gap-3">
                    <span className="text-slate-500 font-medium shrink-0">Subject</span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{targetEntity.label}</span>
                      {targetEntity.secondary && (
                        <span className="block text-[11px] text-slate-500">{targetEntity.secondary}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Key Changes / State (e.g. Stage, Role, Note) */}
                {displayItems.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-start justify-between gap-3">
                    <span className="text-slate-500 font-medium shrink-0">{item.label}</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[260px] break-words">
                      {item.value}
                    </span>
                  </div>
                ))}

                {/* Performed By */}
                <div className="py-2 last:pb-0 flex items-start justify-between gap-3">
                  <span className="text-slate-500 font-medium shrink-0">Performed By</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block">
                      {actor.name}
                    </span>
                    {actor.role && (
                      <span className="block text-[11px] text-slate-500">
                        {actor.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Minimalist Advanced Details (Hidden by default) */}
              <details className="text-[11px] text-slate-400">
                <summary className="cursor-pointer hover:text-slate-600 select-none py-1">
                  Technical information
                </summary>
                <div className="mt-1.5 p-2 bg-slate-100 border border-slate-200 rounded-xs space-y-1 font-mono text-[10px] text-slate-600">
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span>{formatIpAddress(selectedLog.ipAddress)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Event Code:</span>
                    <span>{selectedLog.action}</span>
                  </div>
                </div>
              </details>

              {/* Modal Actions */}
              <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </div>
          </Dialog>
        );
      })()}
    </div>
  );
};