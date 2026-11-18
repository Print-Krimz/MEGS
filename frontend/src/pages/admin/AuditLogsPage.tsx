import { resolveUserName } from "../../lib/user-name";
import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import { notify } from "../../lib/feedback";
import {
  PageHeader,
  SearchFilters,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import { getManilaToday, addManilaCalendarDays } from "../../lib/field-limits";
import { FileText, FileSpreadsheet } from "lucide-react";
import {
  ACTION_LABELS,
  AUDIT_CATEGORIES,
  formatAction,
  getActionCategory,
  formatIpAddress,
  getAuditIp,
  formatTargetEntity,
  extractDisplayDetails,
  formatActor,
  getAuditSeverity,
  getAuditExplanation,
  type AuditSeverity,
} from "../../lib/utils/audit-formatter";
import type { AuditLog } from "../../lib/types/admin.types";
import { ToneBadge } from "./admin-ui";

const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  CRITICAL: "Needs attention",
  WARNING: "Watch",
  INFORMATIONAL: "Info",
};

const SEVERITY_TONES: Record<AuditSeverity, "danger" | "warning" | "neutral"> = {
  CRITICAL: "danger",
  WARNING: "warning",
  INFORMATIONAL: "neutral",
};

const SEVERITY_OPTIONS = [
  { value: "CRITICAL", label: SEVERITY_LABELS.CRITICAL },
  { value: "WARNING", label: SEVERITY_LABELS.WARNING },
  { value: "INFORMATIONAL", label: SEVERITY_LABELS.INFORMATIONAL },
];

const DATE_PRESET_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "7 days" },
  { value: "30D", label: "30 days" },
  { value: "CUSTOM", label: "Custom range" },
];

const dateInputClass =
  "focus-ring min-h-11 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 md:min-h-10";

const resolveEntityHref = (log: AuditLog): string | null => {
  if (!log.entityId) return null;
  const id = String(log.entityId);
  switch (log.entity) {
    case "ManpowerRequest":
      return `/admin/mrfs/${id}`;
    case "JobPosting":
      return `/admin/jobs/${id}`;
    case "Client":
      return `/admin/clients/${id}`;
    case "Application":
      return `/admin/applications/${id}`;
    case "User":
      return "/admin/users";
    default:
      return null;
  }
};

export const AuditLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const urlSearch = useSearch({ strict: false }) as {
    q?: string;
    category?: string;
    action?: string;
    severity?: string;
    range?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
    dir?: "asc" | "desc";
    page?: number;
  };

  const [search, setSearch] = useState(urlSearch.q ?? "");
  useEffect(() => {
    setSearch(urlSearch.q ?? "");
  }, [urlSearch.q]);

  const filterValues = useMemo(
    () => ({
      category: urlSearch.category ?? "",
      action: urlSearch.action ?? "",
    }),
    [urlSearch.category, urlSearch.action],
  );
  const severityFilter = urlSearch.severity || "ALL";
  const datePreset = urlSearch.range || "ALL";
  const startDate = urlSearch.startDate ?? "";
  const endDate = urlSearch.endDate ?? "";
  const page = urlSearch.page && urlSearch.page > 0 ? urlSearch.page : 1;
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10);
  const sort: DataTableSort = {
    key: urlSearch.sort === "when" ? "when" : "when",
    direction: urlSearch.dir === "asc" ? "asc" : "desc",
  };

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);

  const updateUrlSearch = (patch: Record<string, unknown>) => {
    void navigate({
      to: "/admin/audit",
      search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
      replace: true,
    } as never);
  };

  useEffect(() => {
    const trimmed = search.trim();
    const current = urlSearch.q ?? "";
    if (trimmed === current) return;
    const timer = setTimeout(() => {
      updateUrlSearch({ q: trimmed || undefined, page: undefined });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch.q]);

  // Compute effective start and end dates based on preset or custom pickers
  const effectiveDates = useMemo(() => {
    if (datePreset === "CUSTOM") {
      return { startDate: startDate || undefined, endDate: endDate || undefined };
    }
    const today = getManilaToday();
    if (datePreset === "TODAY") {
      return { startDate: today };
    }
    if (datePreset === "7D") {
      return { startDate: addManilaCalendarDays(today, -7) };
    }
    if (datePreset === "30D") {
      return { startDate: addManilaCalendarDays(today, -30) };
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
        limit: 100,
      }),
  });

  const allLogs: AuditLog[] = useMemo(() => auditLogsQuery.data || [], [auditLogsQuery.data]);

  // Client-side quick filter for fast text search, severity filter & sort
  const filteredLogs = useMemo(() => {
    const kept = allLogs.filter((log) => {
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
      const actorName = resolveUserName(log.user, "").toLowerCase();
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
    return [...kept].sort((a, b) => {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort.direction === "asc" ? diff : -diff;
    });
  }, [allLogs, search, severityFilter, sort.direction]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const setPage = (nextPage: number) => updateUrlSearch({ page: nextPage > 1 ? nextPage : undefined });

  const handlePageSizeChange = (nextSize: number) => {
    const valid = nextSize === 25 || nextSize === 50 ? nextSize : 10;
    setPageSize(valid);
    updateUrlSearch({ page: undefined });
  };

  const handleSortChange = (next: DataTableSort) => {
    updateUrlSearch({ sort: next.key, dir: next.direction, page: undefined });
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
  };

  const handleDatePresetChange = (preset: string) => {
    updateUrlSearch({
      range: preset && preset !== "ALL" ? preset : undefined,
      ...(preset !== "CUSTOM" ? { startDate: undefined, endDate: undefined } : {}),
      page: undefined,
    });
  };

  // Importance and date range sit in the same filter row as the server filters.
  const handleFilterChange = (k: string, v: string) => {
    if (k === "range") {
      handleDatePresetChange(v || "ALL");
      return;
    }
    updateUrlSearch({ [k]: v || undefined, page: undefined });
  };

  const handleReset = () => {
    setSearch("");
    updateUrlSearch({
      q: undefined,
      category: undefined,
      action: undefined,
      severity: undefined,
      range: undefined,
      startDate: undefined,
      endDate: undefined,
      page: undefined,
    });
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
      a.download = `MEGS_Admin_Security_Audit_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      notify.error("Export Failed", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportXLSX = async () => {
    try {
      setIsExportingXlsx(true);
      const blob = await adminApi.exportAuditReport("xlsx", {
        action: filterValues.action,
        category: filterValues.category,
        search: search || undefined,
        startDate: effectiveDates.startDate,
        endDate: effectiveDates.endDate,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MEGS_Admin_Security_Audit_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      notify.error("Export Failed", err);
    } finally {
      setIsExportingXlsx(false);
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

  const openButtonClass =
    "focus-ring inline-flex min-h-11 items-center rounded-md text-left text-sm font-semibold text-navy hover:underline md:min-h-9";

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "action",
      header: "What happened",
      primary: true,
      cell: (log) => {
        const summary = extractDisplayDetails(log);
        const detailText =
          Array.isArray(summary) && summary.length > 0
            ? summary.map((s) => `${s.label}: ${s.value}`).join(" • ")
            : "";
        return (
          <div className="flex min-w-0 max-w-xs flex-col">
            <button
              type="button"
              onClick={() => setSelectedLog(log)}
              className={openButtonClass}
            >
              {formatAction(log.action)}
            </button>
            {detailText && (
              <span className="truncate text-xs text-slate-600" title={detailText}>
                {detailText}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "importance",
      header: "Importance",
      cell: (log) => {
        const severity = getAuditSeverity(log);
        return <ToneBadge tone={SEVERITY_TONES[severity]}>{SEVERITY_LABELS[severity]}</ToneBadge>;
      },
    },
    {
      key: "area",
      header: "Area",
      cell: (log) => <span className="text-slate-700">{getActionCategory(log.action)}</span>,
    },
    {
      key: "actor",
      header: "Performed by",
      cell: (log) => {
        const actor = formatActor(log);
        return (
          <div className="flex max-w-[13rem] flex-col">
            <span className="truncate font-medium text-slate-900" title={actor.name}>
              {actor.name}
            </span>
            {actor.email && actor.email !== actor.name && <span className="truncate text-xs text-slate-600" title={actor.email}>{actor.email}</span>}
            {actor.role && <span className="text-xs text-slate-600">{actor.role}</span>}
          </div>
        );
      },
    },
    {
      key: "record",
      header: "Affected record",
      cell: (log) => {
        const target = formatTargetEntity(log);
        const href = resolveEntityHref(log);
        return (
          <div className="flex max-w-[14rem] flex-col">
            {href ? (
              <Link
                to={href as any}
                className="focus-ring truncate rounded-sm font-medium text-navy underline-offset-2 hover:underline"
                title={target.label}
              >
                {target.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-slate-900" title={target.label}>
                {target.label}
              </span>
            )}
            {target.secondary && (
              <span className="truncate text-xs text-slate-600" title={target.secondary}>
                {target.secondary}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "when",
      header: "When",
      sortable: true,
      align: "right",
      cell: (log) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(log.createdAt)}</span>,
    },
  ];

  const renderCard = (log: AuditLog) => {
    const severity = getAuditSeverity(log);
    const target = formatTargetEntity(log);
    const actor = formatActor(log);
    const href = resolveEntityHref(log);
    return (
      <div className="space-y-1.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={() => setSelectedLog(log)} className={openButtonClass}>
            {formatAction(log.action)}
          </button>
          <ToneBadge tone={SEVERITY_TONES[severity]}>{SEVERITY_LABELS[severity]}</ToneBadge>
        </div>
        <div className="text-sm text-slate-600">
          {getActionCategory(log.action)} · {formatDateTime(log.createdAt)}
        </div>
        <div className="text-sm text-slate-800">
          {href ? (
            <Link to={href as any} className="focus-ring rounded-sm font-medium text-navy underline-offset-2 hover:underline">
              {target.label}
            </Link>
          ) : (
            <span className="font-medium">{target.label}</span>
          )}
          {target.secondary && <span className="text-slate-600"> · {target.secondary}</span>}
        </div>
        <div className="truncate text-sm text-slate-600" title={actor.name}>
          By {actor.name}
        </div>
      </div>
    );
  };

  const framed = "rounded-md border border-slate-300 bg-white";

  return (
    <div className="space-y-5">
      <PageHeader
        flush
        title="Activity history"
        description="Who changed accounts, hiring records, settings and backups."
        breadcrumbs={[
          { label: "Administration", href: "/admin" },
          { label: "Activity history" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              onClick={handleExportXLSX}
              disabled={isExportingXlsx || allLogs.length === 0}
            >
              {isExportingXlsx ? "Preparing..." : "Download Excel"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText className="w-3.5 h-3.5" />}
              onClick={handleExportPDF}
              disabled={isExportingPdf || allLogs.length === 0}
            >
              {isExportingPdf ? "Preparing..." : "Download PDF"}
            </Button>
          </div>
        }
      />

      <SearchFilters
        className="mb-5! rounded-md"
        searchPlaceholder="Search what happened, who did it, or what changed..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{
          ...filterValues,
          severity: severityFilter === "ALL" ? "" : severityFilter,
          range: datePreset === "ALL" ? "" : datePreset,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        hasActiveExternalFilters={datePreset === "CUSTOM" && Boolean(startDate || endDate)}
        filters={[
          { key: "category", label: "Area", placeholder: "All areas", options: categoryFilterOptions },
          { key: "action", label: "Change type", placeholder: "All change types", options: actionFilterOptions, searchable: true },
          { key: "severity", label: "Importance", placeholder: "All importance", options: SEVERITY_OPTIONS },
          { key: "range", label: "Date range", placeholder: "All time", options: DATE_PRESET_OPTIONS },
        ]}
        actions={
          datePreset === "CUSTOM" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                min="1900-01-01"
                max={endDate || "2100-12-31"}
                value={startDate}
                onChange={(e) => updateUrlSearch({ startDate: e.target.value || undefined, page: undefined })}
                className={dateInputClass}
                aria-label="Start date"
              />
              <span className="text-sm text-slate-600">to</span>
              <input
                type="date"
                min={startDate || "1900-01-01"}
                max="2100-12-31"
                value={endDate}
                onChange={(e) => updateUrlSearch({ endDate: e.target.value || undefined, page: undefined })}
                className={dateInputClass}
                aria-label="End date"
              />
            </div>
          ) : undefined
        }
      />

      {auditLogsQuery.isLoading ? (
        <div className={framed}>
          <LoadingState variant="table" rows={10} />
        </div>
      ) : auditLogsQuery.isError ? (
        <div className={framed}>
          <ErrorState error={auditLogsQuery.error} onRetry={() => auditLogsQuery.refetch()} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600" aria-live="polite">
            From the latest 100 records
          </p>
          <DataTable
            caption="Activity history"
            columns={columns}
            rows={paginatedLogs}
            getRowId={(log) => String(log.id)}
            renderCard={renderCard}
            cardsBelow="lg"
            sort={sort}
            onSortChange={handleSortChange}
            empty={
              <EmptyState
                bare
                title="No activity found"
                description="Try a different search or clear your filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Clear filters
                  </Button>
                }
              />
            }
            footer={
              filteredLogs.length > 0 ? (
                <div className="p-3">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredLogs.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={handlePageSizeChange}
                    variant="inset"
                    itemLabel="events"
                  />
                </div>
              ) : undefined
            }
          />
        </div>
      )}

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
            description={`Recorded ${formatDateTime(selectedLog.createdAt)}`}
            size="md"
          >
            <div className="space-y-3 font-sans text-sm">
              {/* Security Alert (Only when critical) */}
              {severity === "CRITICAL" && (
                <div className="space-y-0.5 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-900">
                  <span className="font-semibold">Security notice</span>
                  <p className="leading-normal">
                    {explanation.whyItMatters || "This action involves elevated system privileges or security verification."}
                  </p>
                </div>
              )}

              {/* Single Clean Details Card */}
              <div className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-slate-50 p-3">
                {/* Subject & Candidate */}
                {targetEntity.label && (
                  <div className="py-2 first:pt-0 flex items-start justify-between gap-3">
                    <span className="text-slate-600 font-medium shrink-0">Affected record</span>
                    <div className="text-right">
                      {(() => {
                        const href = resolveEntityHref(selectedLog);
                        return href ? (
                          <Link
                            to={href as any}
                            onClick={() => setSelectedLog(null)}
                            className="focus-ring rounded-sm font-semibold text-navy underline-offset-2 hover:underline"
                          >
                            {targetEntity.label}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-900">{targetEntity.label}</span>
                        );
                      })()}
                      {targetEntity.secondary && (
                        <span className="block text-slate-600">{targetEntity.secondary}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Key Changes / State (e.g. Stage, Role, Note) */}
                {displayItems.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-start justify-between gap-3">
                    <span className="text-slate-600 font-medium shrink-0">{item.label}</span>
                    <span className="font-semibold text-slate-900 text-right max-w-[260px] break-words">
                      {item.value}
                    </span>
                  </div>
                ))}

                {/* Performed By */}
                <div className="py-2 last:pb-0 flex items-start justify-between gap-3">
                  <span className="text-slate-600 font-medium shrink-0">Performed by</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900 block break-all">
                      {actor.name}
                    </span>
                    {actor.role && (
                      <span className="block text-slate-600">
                        {actor.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {explanation.recommendedAction && (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <span className="text-xs font-semibold text-slate-600">Recommended action</span>
                  <p className="mt-0.5 text-slate-800">{explanation.recommendedAction}</p>
                </div>
              )}

              {/* Advanced details (hidden by default) */}
              <details className="text-slate-600">
                <summary className="focus-ring flex min-h-11 cursor-pointer select-none items-center rounded-md hover:text-slate-900">
                  Technical information
                </summary>
                <div className="mt-1.5 space-y-1 rounded-md border border-slate-200 bg-slate-100 p-2 text-slate-600">
                  <div className="flex justify-between gap-3">
                    <span>IP address:</span>
                    <span>{formatIpAddress(getAuditIp(selectedLog))}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Event code:</span>
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
