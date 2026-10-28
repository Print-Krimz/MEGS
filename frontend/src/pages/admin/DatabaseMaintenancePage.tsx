import React, { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../lib/api/admin.api";
import {
  PageHeader,
  LoadingState,
  ErrorState,
  EmptyState,
  SearchFilters,
  Pagination,
  ActionMenu,
  DataTable,
  type DataTableColumn,
} from "../../components/common";
import { Button, Dialog, Input } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import { RefreshCw, HardDrive, RotateCcw, Upload } from "lucide-react";
import type { DatabaseBackupRecord, MaintenanceProgress } from "../../lib/types/admin.types";
import { backupDisplayName, backupDownloadName } from "../../lib/backup-name";
import { FIELD_LIMITS } from "../../lib/field-limits";
import { formatAdminBackupStatus } from "../../lib/admin-copy";
import { formatErrorMessage } from "../../lib/feedback";
import { FeedbackBanner, ToneBadge } from "./admin-ui";

const formatProgress = (progress: MaintenanceProgress | null | undefined): string | null => {
  if (!progress) return null;
  const rows = progress.rowsTotal
    ? ` (${progress.rowsDone.toLocaleString()} of ${progress.rowsTotal.toLocaleString()} records)`
    : progress.rowsDone ? ` (${progress.rowsDone.toLocaleString()} records read)` : "";
  return `${progress.table}, table ${progress.tableIndex + 1} of ${progress.tableCount}${rows}`;
};

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const STATUS_OPTIONS = [
  { value: "SUCCESS", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "IN_PROGRESS", label: "In progress" },
];

const DATE_PRESET_OPTIONS = [
  { value: "TODAY", label: "Today" },
  { value: "7D", label: "7 days" },
  { value: "30D", label: "30 days" },
  { value: "CUSTOM", label: "Custom range" },
];

const dateInputClass =
  "focus-ring min-h-11 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 md:min-h-10";

export const DatabaseMaintenancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [backupNameInput, setBackupNameInput] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Rename State
  const [renameTarget, setRenameTarget] = useState<DatabaseBackupRecord | null>(null);
  const [renameInput, setRenameInput] = useState("");

  const [restoreTarget, setRestoreTarget] = useState<
    | { mode: "RECORD"; backup: DatabaseBackupRecord }
    | { mode: "FILE"; file: File }
    | null
  >(null);
  const [restoreConfirmInput, setRestoreConfirmInput] = useState("");

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [datePreset, setDatePreset] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [lastActionResult, setLastActionResult] = useState<{
    type: "SUCCESS" | "FAILED";
    message: string;
    details?: string;
  } | null>(null);

  const backupsQuery = useQuery({
    queryKey: ["admin", "maintenance", "backups"],
    queryFn: () => adminApi.listDatabaseBackups(100),
    // Backups run in the background; poll until none are in progress.
    refetchInterval: (query) =>
      query.state.data?.some((backup) => backup.status === "IN_PROGRESS") ? 5000 : false,
  });

  // Restores also run in the background; poll while one is in progress.
  const restoresQuery = useQuery({
    queryKey: ["admin", "maintenance", "restores"],
    queryFn: () => adminApi.listDatabaseRestores(10),
    refetchInterval: (query) =>
      query.state.data?.some((restore) => restore.status === "IN_PROGRESS") ? 5000 : false,
  });
  const activeRestore = restoresQuery.data?.find((restore) => restore.status === "IN_PROGRESS");
  const restoringBackup = backupsQuery.data?.find((backup) => backup.id === activeRestore?.backupId);
  const activeBackup = backupsQuery.data?.find((backup) => backup.status === "IN_PROGRESS");
  const backupRunning = !!activeBackup;
  const [watchedRestoreId, setWatchedRestoreId] = useState<string | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Report the outcome of the restore this page started once it finishes.
  useEffect(() => {
    const watched = restoresQuery.data?.find((restore) => restore.id === watchedRestoreId);
    if (!watched || watched.status === "IN_PROGRESS") return;
    setWatchedRestoreId(null);
    if (watched.status === "SUCCESS") {
      queryClient.invalidateQueries();
      setLastActionResult({
        type: "SUCCESS",
        message: "Backup restored.",
        details: `Current data now matches the selected backup${watched.totalRecords ? ` (${watched.totalRecords} records restored)` : ""}.`,
      });
    } else {
      setLastActionResult({
        type: "FAILED",
        message: "We couldn't restore this backup.",
        details: watched.errorMessage || undefined,
      });
    }
  }, [restoresQuery.data, watchedRestoreId, queryClient]);

  const triggerBackupMutation = useMutation({
    mutationFn: (customName?: string) => adminApi.triggerDatabaseBackup(customName),
    onSuccess: (newBackup) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "backups"] });
      setIsConfirmOpen(false);
      setBackupNameInput("");
      setLastActionResult({
        type: "SUCCESS",
         message: "Backup started.",
        details: newBackup
          ? `${backupDisplayName(newBackup)} is being created. Its status will update in the backup history below.`
          : "The backup is being created. Its status will update in the backup history below.",
      });
    },
    onError: (err: any) => {
      setIsConfirmOpen(false);
      setLastActionResult({
        type: "FAILED",
         message: "We couldn't create the backup.",
         details: formatErrorMessage(err),
      });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return await adminApi.renameDatabaseBackup(id, name);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "backups"] });
      setRenameTarget(null);
      setRenameInput("");
      setLastActionResult({
        type: "SUCCESS",
         message: "Backup renamed.",
        details: `Saved as ${backupDisplayName(updated)}.`,
      });
    },
    onError: (err: any) => {
      setRenameTarget(null);
      setRenameInput("");
      setLastActionResult({
        type: "FAILED",
         message: "We couldn't rename this backup.",
         details: formatErrorMessage(err),
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (target: { mode: "RECORD"; backup: DatabaseBackupRecord } | { mode: "FILE"; file: File }) => {
      if (target.mode === "RECORD") {
        return await adminApi.restoreDatabaseBackup(target.backup.id);
      } else {
        return await adminApi.restoreUploadedBackup(target.file);
      }
    },
    onSuccess: (restore) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "restores"] });
      setWatchedRestoreId(restore.id);
      setRestoreTarget(null);
      setRestoreConfirmInput("");
      setLastActionResult(null);
    },
    onError: (err: any) => {
      setRestoreTarget(null);
      setRestoreConfirmInput("");
      setLastActionResult({
        type: "FAILED",
         message: "We couldn't restore this backup.",
         details: formatErrorMessage(err),
      });
    },
  });

  const cancelMaintenanceMutation = useMutation({
    mutationFn: () => adminApi.cancelMaintenance(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "backups"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "restores"] });
      setIsCancelDialogOpen(false);
      setLastActionResult({
        type: "SUCCESS",
        message: "Maintenance jobs reset.",
        details:
          (result?.cancelledBackups || 0) + (result?.cancelledRestores || 0) > 0
            ? `Cancelled ${result?.cancelledBackups || 0} running backup(s) and ${result?.cancelledRestores || 0} restore(s). You can now create a new backup.`
            : "No active maintenance jobs were running.",
      });
    },
    onError: (err: any) => {
      setIsCancelDialogOpen(false);
      setLastActionResult({
        type: "FAILED",
        message: "We couldn't reset maintenance jobs.",
        details: formatErrorMessage(err),
      });
    },
  });

  const maintenanceBusy = backupRunning || !!activeRestore || restoreMutation.isPending;

  const handleDownload = async (backup: DatabaseBackupRecord) => {
    try {
      setDownloadingId(backup.id);
      const blob = await adminApi.downloadDatabaseBackup(backup.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backupDownloadName(backup);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setLastActionResult({
        type: "FAILED",
        message: "We couldn't download this backup.",
        details: formatErrorMessage(err),
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleFileUploadSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreTarget({ mode: "FILE", file });
      setRestoreConfirmInput("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const backups = useMemo(() => backupsQuery.data || [], [backupsQuery.data]);

  // Effective start and end dates based on preset or custom pickers
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

  // Client-side filtering logic
  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      // 1. Status filter
      const activeStatus = filterValues.status || statusFilter;
      if (activeStatus !== "ALL" && activeStatus) {
        if (b.status !== activeStatus) {
          return false;
        }
      }

      // 2. Date filter
      if (effectiveDates.startDate) {
        const createdAt = new Date(b.createdAt).getTime();
        const start = new Date(effectiveDates.startDate).getTime();
        if (createdAt < start) return false;
      }
      if (effectiveDates.endDate) {
        const createdAt = new Date(b.createdAt).getTime();
        const end = new Date(effectiveDates.endDate).setHours(23, 59, 59, 999);
        if (createdAt > end) return false;
      }

      // 3. Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const filename = backupDisplayName(b).toLowerCase();
        const email = (b.initiatedBy?.email || "").toLowerCase();
        const backupType = (b.backupType || "").toLowerCase();

        return (
          filename.includes(q) ||
          email.includes(q) ||
          backupType.includes(q)
        );
      }

      return true;
    });
  }, [backups, statusFilter, filterValues, effectiveDates, search]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredBackups.length / pageSize) || 1;
  const paginatedBackups = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBackups.slice(start, start + pageSize);
  }, [filteredBackups, page, pageSize]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (k: string, v: string) => {
    if (k === "range") {
      handleDatePresetChange(v || "ALL");
      return;
    }
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    if (k === "status") {
      setStatusFilter(v || "ALL");
    }
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
    setStatusFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const framed = "rounded-md border border-slate-300 bg-white";

  const statusTone = (status: string): "success" | "danger" | "info" =>
    status === "SUCCESS" ? "success" : status === "FAILED" ? "danger" : "info";

  const backupMenuItems = (b: DatabaseBackupRecord) => [
    { label: "Rename backup", onSelect: () => { setRenameTarget(b); setRenameInput(backupDisplayName(b)); } },
    ...(b.status === "IN_PROGRESS" ? [
      { label: "Cancel backup", tone: "danger" as const, onSelect: () => setIsCancelDialogOpen(true) },
    ] : []),
    ...(b.status === "SUCCESS" ? [
      { label: downloadingId === b.id ? "Downloading..." : "Download backup", onSelect: () => handleDownload(b), disabled: downloadingId === b.id },
      { label: "Restore this backup", tone: "danger" as const, onSelect: () => { setRestoreTarget({ mode: "RECORD", backup: b }); setRestoreConfirmInput(""); }, disabled: maintenanceBusy },
    ] : []),
  ];

  const columns: DataTableColumn<DatabaseBackupRecord>[] = [
    {
      key: "name",
      header: "Backup name",
      primary: true,
      cell: (b) => <span className="font-medium text-slate-900">{backupDisplayName(b)}</span>,
    },
    {
      key: "created",
      header: "Created",
      cell: (b) => <span className="whitespace-nowrap text-slate-600">{formatDateTime(b.createdAt)}</span>,
    },
    { key: "size", header: "Size", cell: (b) => <span className="text-slate-600">{formatBytes(b.sizeBytes)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <div>
          <span title={b.status === "FAILED" && b.errorMessage ? b.errorMessage : undefined}>
            <ToneBadge tone={statusTone(b.status)}>{formatAdminBackupStatus(b.status)}</ToneBadge>
          </span>
          {b.status === "IN_PROGRESS" && formatProgress(b.progress) && (
            <div className="mt-1 text-xs text-slate-500">Reading {formatProgress(b.progress)}</div>
          )}
        </div>
      ),
    },
    {
      key: "creator",
      header: "Created by",
      cell: (b) => (
        <span className="block max-w-[14rem] truncate text-slate-700" title={b.initiatedBy?.email || "System"}>
          {b.initiatedBy?.email || "System"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (b) => <ActionMenu label={`Actions for ${backupDisplayName(b)}`} items={backupMenuItems(b)} />,
    },
  ];

  const renderCard = (b: DatabaseBackupRecord) => (
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-sm font-medium text-slate-950">{backupDisplayName(b)}</div>
          <div className="mt-1 text-sm text-slate-500">{formatDateTime(b.createdAt)}</div>
        </div>
        <ActionMenu label={`Actions for ${backupDisplayName(b)}`} items={backupMenuItems(b)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div><dt className="text-slate-500">Size</dt><dd className="text-slate-700">{formatBytes(b.sizeBytes)}</dd></div>
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="mt-0.5"><ToneBadge tone={statusTone(b.status)}>{formatAdminBackupStatus(b.status)}</ToneBadge></dd>
        </div>
        {b.status === "IN_PROGRESS" && formatProgress(b.progress) && (
          <div className="col-span-2"><dt className="text-slate-500">Progress</dt><dd className="text-slate-700">Reading {formatProgress(b.progress)}</dd></div>
        )}
        <div><dt className="text-slate-500">Created by</dt><dd className="break-all text-slate-700">{b.initiatedBy?.email || "System"}</dd></div>
        {b.status === "FAILED" && b.errorMessage && (
          <div className="col-span-2"><dt className="text-slate-500">Error</dt><dd className="text-rose-700">{b.errorMessage}</dd></div>
        )}
      </dl>
    </div>
  );

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        flush
        title="Backups and recovery"
        description="Back up recruitment data and restore earlier copies."
        breadcrumbs={[
          { href: "/admin", label: "Administration" },
          { label: "Backups and recovery" },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUploadSelect}
              accept=".enc.gz,.gz,application/octet-stream,application/gzip"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => backupsQuery.refetch()}
              disabled={backupsQuery.isFetching}
            >
              Refresh list
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={maintenanceBusy}
            >
              Restore from a file
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<HardDrive className="w-3.5 h-3.5" />}
              onClick={() => setIsConfirmOpen(true)}
              disabled={triggerBackupMutation.isPending || maintenanceBusy}
            >
              {triggerBackupMutation.isPending ? "Creating backup..." : "Create backup"}
            </Button>
          </div>
        }
      />

      {lastActionResult && (
        <FeedbackBanner
          type={lastActionResult.type === "SUCCESS" ? "success" : "error"}
          onDismiss={() => setLastActionResult(null)}
          message={
            <>
              <span className="font-medium">{lastActionResult.message}</span>
              {lastActionResult.details && <span className="block">{lastActionResult.details}</span>}
            </>
          }
        />
      )}

      {activeRestore && (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-700 [animation-direction:reverse]" aria-hidden="true" />
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">Restore in progress</h2>
              <p>
                Restoring {(restoringBackup ? backupDisplayName(restoringBackup) : "uploaded backup")}. Backups and other restores are paused until it finishes.
              </p>
              <p className="text-slate-600">
                {formatProgress(activeRestore.progress) ?? "Preparing the backup file..."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCancelDialogOpen(true)}
            className="shrink-0 self-start border-rose-300 text-rose-700 hover:bg-rose-50 sm:self-auto"
          >
            Cancel restore
          </Button>
        </div>
      )}

      {activeBackup && (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-3.5 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-700" aria-hidden="true" />
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold">Backup in progress</h2>
              <p>
                Creating {backupDisplayName(activeBackup)}. Snapshot data is streaming from the database.
              </p>
              <p className="text-slate-600">
                {formatProgress(activeBackup.progress) ? `Reading ${formatProgress(activeBackup.progress)}` : "Preparing snapshot..."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCancelDialogOpen(true)}
            className="shrink-0 self-start border-rose-300 text-rose-700 hover:bg-rose-50 sm:self-auto"
          >
            Cancel backup
          </Button>
        </div>
      )}

      <SearchFilters
        className="mb-5! rounded-md"
        searchPlaceholder="Search backup name or creator..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={{
          status: filterValues.status || "",
          range: datePreset === "ALL" ? "" : datePreset,
        }}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          { key: "status", label: "Status", placeholder: "All statuses", options: STATUS_OPTIONS },
          { key: "range", label: "Date range", placeholder: "All time", options: DATE_PRESET_OPTIONS },
        ]}
        actions={
          datePreset === "CUSTOM" ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className={dateInputClass}
                aria-label="Start date"
              />
              <span className="text-sm text-slate-500">to</span>
              <input
                type="date"
                min="1900-01-01"
                max="2100-12-31"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className={dateInputClass}
                aria-label="End date"
              />
            </div>
          ) : undefined
        }
      />

      {backupsQuery.isLoading ? (
        <div className={framed}>
          <LoadingState variant="table" rows={5} />
        </div>
      ) : backupsQuery.isError ? (
        <div className={framed}>
          <ErrorState error={backupsQuery.error} onRetry={() => backupsQuery.refetch()} />
        </div>
      ) : backups.length === 0 ? (
        <div className={framed}>
          <EmptyState
            bare
            title="No backups yet"
            description="Create a backup to protect candidates, jobs, applications, and settings."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsConfirmOpen(true)}
                disabled={triggerBackupMutation.isPending}
              >
                Create backup
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600" aria-live="polite">
            Showing {filteredBackups.length} {filteredBackups.length === 1 ? "backup" : "backups"}
          </p>
          <DataTable
            caption="Backup history"
            columns={columns}
            rows={paginatedBackups}
            getRowId={(b) => b.id}
            renderCard={renderCard}
            empty={
              <EmptyState
                bare
                title="No backups match your filters"
                description="Try a different search or clear your filters."
                action={
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Clear filters
                  </Button>
                }
              />
            }
            footer={
              filteredBackups.length > pageSize ? (
                <div className="p-2">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={filteredBackups.length}
                    pageSize={pageSize}
                    itemLabel="backups"
                  />
                </div>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Create Backup Confirmation Modal */}
      {isConfirmOpen && (
        <Dialog
          open={isConfirmOpen}
          onClose={() => {
            setIsConfirmOpen(false);
            setBackupNameInput("");
          }}
           title="Create a backup"
           description="Save a secure copy of candidates, jobs, applications, and settings."
          size="md"
        >
          <div className="space-y-4 font-sans text-sm">
            <div className="space-y-1">
              <Input
                id="backup-name"
                label="Backup name (optional)"
                maxLength={FIELD_LIMITS.shortText}
                value={backupNameInput}
                onChange={(e) => setBackupNameInput(e.target.value)}
                placeholder="e.g. Pre-Deployment Checkpoint"
                helperText="Use a name your team will recognize. Leave blank to use the creation date."
                disabled={triggerBackupMutation.isPending}
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-sm">
               <span className="font-semibold text-slate-900 block">This backup includes</span>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
                <li>Includes all candidates, job applications, interview notes, and system settings</li>
                 <li>Encrypted and available only to administrators</li>
                 <li>Ready to download when complete</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsConfirmOpen(false);
                  setBackupNameInput("");
                }}
                disabled={triggerBackupMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<HardDrive className="w-3.5 h-3.5" />}
                onClick={() => triggerBackupMutation.mutate(backupNameInput.trim() || undefined)}
                disabled={triggerBackupMutation.isPending}
              >
                 {triggerBackupMutation.isPending ? "Creating backup..." : "Create backup"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Rename Backup Modal */}
      {renameTarget && (
        <Dialog
          open={!!renameTarget}
          onClose={() => {
            if (!renameMutation.isPending) {
              setRenameTarget(null);
              setRenameInput("");
            }
          }}
           title="Rename backup"
           description="Give this backup a name that is easy to recognize."
          size="sm"
        >
          <div className="space-y-4 font-sans text-sm">
            <div className="space-y-1.5">
              <Input
                id="rename-backup-name"
                label="Backup name"
                maxLength={FIELD_LIMITS.shortText}
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Enter backup name"
                helperText="Changing this name keeps the backup and its recovery link intact."
                disabled={renameMutation.isPending}
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameInput("");
                }}
                disabled={renameMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (renameInput.trim()) {
                    renameMutation.mutate({
                      id: renameTarget.id,
                      name: renameInput.trim(),
                    });
                  }
                }}
                disabled={!renameInput.trim() || renameMutation.isPending}
              >
                 {renameMutation.isPending ? "Saving..." : "Save name"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Restore Safety Confirmation Modal */}
      {restoreTarget && (
        <Dialog
          open={!!restoreTarget}
          onClose={() => {
            if (!restoreMutation.isPending) {
              setRestoreTarget(null);
              setRestoreConfirmInput("");
            }
          }}
           title="Restore this backup"
           description="Replace current data with the version saved in this backup."
          size="md"
        >
          <div className="space-y-4 font-sans text-sm">
            <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="block font-semibold">Before you continue</span>
              <p className="leading-normal">
                Changes made after this backup date will be replaced. Create or download a current backup first if you may need those changes.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5 text-sm text-slate-700">
               <span className="font-semibold text-slate-900 block">Backup details</span>
              {restoreTarget.mode === "RECORD" ? (
                <div className="space-y-1">
                  <div><strong>Name:</strong> {backupDisplayName(restoreTarget.backup)}</div>
                  <div><strong>Size:</strong> {formatBytes(restoreTarget.backup.sizeBytes)}</div>
                  <div><strong>Created:</strong> {formatDateTime(restoreTarget.backup.createdAt)}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div><strong>File:</strong> {restoreTarget.file.name.replace(/\.enc\.gz$/, "")}</div>
                  <div><strong>Size:</strong> {formatBytes(restoreTarget.file.size)}</div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="restore-confirm" className="block font-semibold text-slate-800 text-sm">
                To confirm, type <span className="font-bold text-rose-700">RESTORE</span> below:
              </label>
              <Input
                id="restore-confirm"
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                placeholder="Type RESTORE to confirm"
                disabled={restoreMutation.isPending}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRestoreTarget(null);
                  setRestoreConfirmInput("");
                }}
                disabled={restoreMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => restoreMutation.mutate(restoreTarget)}
                disabled={
                  restoreConfirmInput.trim().toUpperCase() !== "RESTORE" ||
                  restoreMutation.isPending
                }
              >
                 {restoreMutation.isPending ? "Starting restore..." : "Restore backup"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Cancel Maintenance Confirmation Dialog */}
      {isCancelDialogOpen && (
        <Dialog
          open={isCancelDialogOpen}
          onClose={() => {
            if (!cancelMaintenanceMutation.isPending) {
              setIsCancelDialogOpen(false);
            }
          }}
          title="Reset active maintenance job"
          description="Cancel any running backup or restore that is in progress or stopped responding."
          size="sm"
        >
          <div className="space-y-4 font-sans text-sm">
            <p className="text-slate-700 text-sm">
              Are you sure you want to cancel the active maintenance operation? The running job will be marked as cancelled, freeing the system to accept new backups and restores.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCancelDialogOpen(false)}
                disabled={cancelMaintenanceMutation.isPending}
              >
                Keep waiting
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelMaintenanceMutation.mutate()}
                disabled={cancelMaintenanceMutation.isPending}
              >
                {cancelMaintenanceMutation.isPending ? "Cancelling..." : "Cancel job"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
