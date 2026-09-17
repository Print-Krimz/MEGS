import React, { useState, useRef, useMemo } from "react";
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
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import {
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  RotateCcw,
  Upload,
  Calendar,
} from "lucide-react";
import type { DatabaseBackupRecord } from "../../lib/types/admin.types";
import { formatAdminBackupStatus } from "../../lib/admin-copy";
import { formatErrorMessage } from "../../lib/feedback";

const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

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
  });

  const triggerBackupMutation = useMutation({
    mutationFn: (customName?: string) => adminApi.triggerDatabaseBackup(customName),
    onSuccess: (newBackup) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "backups"] });
      setIsConfirmOpen(false);
      setBackupNameInput("");
      setLastActionResult({
        type: "SUCCESS",
         message: "Backup created.",
        details: newBackup?.filename
          ? `File ${newBackup.filename} (${formatBytes(newBackup.sizeBytes)}) is ready for download.`
          : "Backup created and secured.",
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
        details: `Saved as ${updated.filename}.`,
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
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "maintenance", "backups"] });
      setRestoreTarget(null);
      setRestoreConfirmInput("");
      setLastActionResult({
        type: "SUCCESS",
         message: "Backup restored.",
         details: `Current data now matches the selected backup${res.totalRecords ? ` (${res.totalRecords} records restored)` : ""}.`,
      });
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

  const handleDownload = async (backup: DatabaseBackupRecord) => {
    try {
      setDownloadingId(backup.id);
      const blob = await adminApi.downloadDatabaseBackup(backup.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = backup.filename;
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
  const latestBackup = backups[0];
  const successfulBackups = backups.filter((b) => b.status === "SUCCESS").length;

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
        const filename = (b.filename || "").toLowerCase();
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
    setFilterValues((prev) => ({ ...prev, [k]: v }));
    if (k === "status") {
      setStatusFilter(v || "ALL");
    }
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setFilterValues((prev) => ({ ...prev, status: status === "ALL" ? "" : status }));
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

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageHeader
        title="Backups and recovery"
        description="Create a safe copy of recruitment data or restore an earlier copy when needed."
        breadcrumbs={[
          { href: "/admin", label: "Administration" },
          { label: "Backups and recovery" },
        ]}
        actions={
          <div className="flex items-center gap-2">
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
              variant="primary"
              size="sm"
              leftIcon={<HardDrive className="w-3.5 h-3.5" />}
              onClick={() => setIsConfirmOpen(true)}
              disabled={triggerBackupMutation.isPending}
            >
               {triggerBackupMutation.isPending ? "Creating backup..." : "Create backup"}
            </Button>
          </div>
        }
      />

      {/* Notification Banners */}
      {lastActionResult && (
        <div
          role={lastActionResult.type === "FAILED" ? "alert" : "status"}
          aria-live="polite"
          className={`p-3.5 border rounded-sm flex items-start justify-between ${
            lastActionResult.type === "SUCCESS"
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-rose-50 border-rose-300 text-rose-950"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {lastActionResult.type === "SUCCESS" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            )}
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold font-sans">
                {lastActionResult.type === "SUCCESS" ? "Action Complete" : "Action Failed"}
              </h4>
              <p className="text-xs font-sans text-slate-700">{lastActionResult.message}</p>
              {lastActionResult.details && (
                <p className="text-[11px] text-slate-500 font-sans">{lastActionResult.details}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setLastActionResult(null)}
            className="text-xs text-slate-400 hover:text-slate-700 px-2 py-0.5 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Stat Tiles */}
      {backupsQuery.isLoading ? <LoadingState variant="cards" /> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
           <span className="text-sm font-medium">Total backups</span>
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">{backups.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">{successfulBackups} available to download or restore</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
           <span className="text-sm font-medium">Latest backup</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
             {latestBackup ? formatAdminBackupStatus(latestBackup.status) : "None yet"}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {latestBackup ? formatDateTime(latestBackup.createdAt) : "Ready to create"}
          </p>
        </div>

      </div>}

      <div className="border border-slate-300 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recovery options</h2>
          <p className="text-sm text-slate-600 mt-0.5">Restore a saved backup only when you need to replace current data.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Upload className="w-3.5 h-3.5" />}
          onClick={() => fileInputRef.current?.click()}
          disabled={restoreMutation.isPending}
        >
          Restore from a file
        </Button>
      </div>

      {/* Main Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search backup name or creator..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[]}
      />

      {/* Status & Date Quick Filter Toolbar */}
      <div className="bg-white p-3 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status Toggle Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-600">Status:</span>
          <div className="inline-flex rounded-sm border border-slate-300 p-0.5 bg-slate-100">
            {[
              { id: "ALL", label: "All" },
              { id: "SUCCESS", label: "Completed" },
              { id: "FAILED", label: "Failed" },
              { id: "IN_PROGRESS", label: "In Progress" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStatusFilterChange(s.id)}
                aria-pressed={statusFilter === s.id}
                  className={`min-h-9 px-3 py-1 text-sm font-medium transition-colors rounded-xs cursor-pointer ${
                  statusFilter === s.id
                    ? "bg-white text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-600 flex items-center gap-1">
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
                aria-pressed={datePreset === p.id}
                className={`min-h-9 px-3 py-1 text-sm font-medium transition-colors rounded-xs cursor-pointer ${
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
                 className="min-h-10 px-2 py-1 border border-slate-300 rounded text-sm bg-white"
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
                 className="min-h-10 px-2 py-1 border border-slate-300 rounded text-sm bg-white"
                aria-label="End date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Backup Records Table */}
      <div className="border border-slate-300 bg-white shadow-xs">
        <div className="px-3.5 py-2.5 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-700" />
             <h3 className="text-sm font-semibold text-slate-900">
               Backup history
            </h3>
          </div>
          <span className="text-[11px] text-slate-600 font-medium">
             Showing {filteredBackups.length} {filteredBackups.length === 1 ? "backup" : "backups"}
          </span>
        </div>

        {backupsQuery.isLoading ? (
          <LoadingState variant="table" rows={5} />
        ) : backupsQuery.isError ? (
          <ErrorState
            error={backupsQuery.error}
            onRetry={() => backupsQuery.refetch()}
          />
        ) : backups.length === 0 ? (
          <EmptyState
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
        ) : filteredBackups.length === 0 ? (
          <EmptyState
            title="No backups match your filters"
            description="Try a different search or clear your filters."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
          <div className="md:hidden divide-y divide-slate-200">
            {paginatedBackups.map((b) => (
              <div key={b.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-950 break-words">{b.filename.replace(/\.enc\.gz$/, "")}</div>
                    <div className="text-xs text-slate-500 mt-1">{formatDateTime(b.createdAt)}</div>
                  </div>
                  <ActionMenu
                    label={`Actions for ${b.filename.replace(/\.enc\.gz$/, "")}`}
                    items={[
                      { label: "Rename backup", onSelect: () => { setRenameTarget(b); setRenameInput(b.filename.replace(/\.enc\.gz$/, "")); } },
                      ...(b.status === "SUCCESS" ? [
                        { label: "Download backup", onSelect: () => handleDownload(b) },
                        { label: "Restore this backup", tone: "danger" as const, onSelect: () => { setRestoreTarget({ mode: "RECORD", backup: b }); setRestoreConfirmInput(""); } },
                      ] : []),
                    ]}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-xs text-slate-500">Size</dt><dd className="text-slate-700">{formatBytes(b.sizeBytes)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Status</dt><dd className="text-slate-700">{formatAdminBackupStatus(b.status)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Created by</dt><dd className="text-slate-700 break-all">{b.initiatedBy?.email || "System"}</dd></div>
                </dl>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-[11px] border-b border-slate-300">
                <tr>
                   <th className="px-3.5 py-2.5">Created</th>
                   <th className="px-3.5 py-2.5">Backup name</th>
                   <th className="px-3.5 py-2.5">Size</th>
                  <th className="px-3.5 py-2.5">Status</th>
                   <th className="px-3.5 py-2.5">Created by</th>
                  <th className="px-3.5 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedBackups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                      {formatDateTime(b.createdAt)}
                    </td>
                     <td className="px-3.5 py-2.5 font-medium text-slate-900">
                       <span className="text-sm text-slate-900">{b.filename.replace(/\.enc\.gz$/, "")}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {formatBytes(b.sizeBytes)}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span
                        className={`inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded-xs border ${
                          b.status === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : b.status === "FAILED"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}
                      >
                         {formatAdminBackupStatus(b.status)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">
                      {b.initiatedBy?.email || "System"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                       <ActionMenu
                         label={`Actions for ${b.filename.replace(/\.enc\.gz$/, "")}`}
                         items={[
                           { label: "Rename backup", onSelect: () => { setRenameTarget(b); setRenameInput(b.filename.replace(/\.enc\.gz$/, "")); } },
                           ...(b.status === "SUCCESS" ? [
                             { label: downloadingId === b.id ? "Downloading..." : "Download backup", onSelect: () => handleDownload(b), disabled: downloadingId === b.id },
                             { label: "Restore this backup", tone: "danger" as const, onSelect: () => { setRestoreTarget({ mode: "RECORD", backup: b }); setRestoreConfirmInput(""); }, disabled: restoreMutation.isPending },
                           ] : []),
                         ]}
                       />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* Pagination Controls */}
        {filteredBackups.length > pageSize && (
          <div className="p-2 border-t border-slate-200">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredBackups.length}
              pageSize={pageSize}
              itemLabel="backups"
            />
          </div>
        )}
      </div>

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
          <div className="space-y-4 font-sans text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-800 text-xs">
                 Backup name (optional)
              </label>
              <input
                type="text"
                value={backupNameInput}
                onChange={(e) => setBackupNameInput(e.target.value)}
                placeholder="e.g. Pre-Deployment Checkpoint"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 font-sans"
                disabled={triggerBackupMutation.isPending}
              />
              <p className="text-[10px] text-slate-500">
                 Leave blank to use an automatically generated name.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm space-y-2 text-xs">
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
          <div className="space-y-4 font-sans text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800 text-xs">
                 Backup name
              </label>
              <input
                type="text"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                placeholder="Enter backup name"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 font-sans"
                disabled={renameMutation.isPending}
                autoFocus
              />
              <p className="text-[10px] text-slate-500">
                 The secure file format is kept automatically.
              </p>
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
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                 <span>Before you continue</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                 Changes made after this backup date will be replaced. Create or download a current backup first if you may need those changes.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm space-y-1.5 text-xs text-slate-700">
               <span className="font-semibold text-slate-900 block">Backup details</span>
              {restoreTarget.mode === "RECORD" ? (
                <div className="space-y-1">
                  <div><strong>Name:</strong> {restoreTarget.backup.filename.replace(/\.enc\.gz$/, "")}</div>
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
              <label className="block font-semibold text-slate-800 text-xs">
                 To confirm, type <span className="font-mono text-rose-700 font-bold">RESTORE</span> below:
              </label>
              <input
                type="text"
                value={restoreConfirmInput}
                onChange={(e) => setRestoreConfirmInput(e.target.value)}
                placeholder="Type RESTORE to confirm"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono uppercase"
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
                className="border-rose-700"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => restoreMutation.mutate(restoreTarget)}
                disabled={
                  restoreConfirmInput.trim().toUpperCase() !== "RESTORE" ||
                  restoreMutation.isPending
                }
              >
                 {restoreMutation.isPending ? "Restoring backup..." : "Restore backup"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
