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
} from "../../components/common";
import { Button, Dialog } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import {
  Database,
  ShieldCheck,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Lock,
  RotateCcw,
  Upload,
  Calendar,
  Pencil,
} from "lucide-react";
import type { DatabaseBackupRecord } from "../../lib/types/admin.types";

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
        message: "Database backup created successfully.",
        details: newBackup?.filename
          ? `File ${newBackup.filename} (${formatBytes(newBackup.sizeBytes)}) is ready for download.`
          : "Backup created and secured.",
      });
    },
    onError: (err: any) => {
      setIsConfirmOpen(false);
      setLastActionResult({
        type: "FAILED",
        message: "Could not create database backup.",
        details:
          err?.response?.data?.error ||
          err?.message ||
          "Please try again or contact system support.",
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
        message: "Backup renamed successfully.",
        details: `Saved as ${updated.filename}.`,
      });
    },
    onError: (err: any) => {
      setRenameTarget(null);
      setRenameInput("");
      setLastActionResult({
        type: "FAILED",
        message: "Could not rename backup.",
        details: err?.response?.data?.error || err?.message || "Please check the name and try again.",
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
        message: "Database restored successfully.",
        details: `Restored ${res.totalRecords || "all"} records in ${res.durationMs || 0}ms.`,
      });
    },
    onError: (err: any) => {
      setRestoreTarget(null);
      setRestoreConfirmInput("");
      setLastActionResult({
        type: "FAILED",
        message: "Failed to restore database.",
        details:
          err?.response?.data?.error ||
          err?.message ||
          "Please verify that the backup file is valid and undamaged.",
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
      alert(err?.message || "Failed to download backup file");
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

  const backups = backupsQuery.data || [];
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
        title="Database maintenance"
        description="Create, manage, and download secure backups of candidate, job, and application data."
        breadcrumbs={[
          { href: "/admin", label: "Administration" },
          { label: "Database maintenance" },
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
              leftIcon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => fileInputRef.current?.click()}
              disabled={restoreMutation.isPending}
            >
              Upload & Restore
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => backupsQuery.refetch()}
              disabled={backupsQuery.isFetching}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<HardDrive className="w-3.5 h-3.5" />}
              onClick={() => setIsConfirmOpen(true)}
              disabled={triggerBackupMutation.isPending}
            >
              {triggerBackupMutation.isPending ? "Creating Backup..." : "Create Backup"}
            </Button>
          </div>
        }
      />

      {/* Notification Banners */}
      {lastActionResult && (
        <div
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

      {/* 4 Summary Stat Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Total Backups</span>
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900">{backups.length}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">{successfulBackups} available to download or restore</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Latest Backup</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">
            {latestBackup ? (latestBackup.status === "SUCCESS" ? "Completed" : "In Progress") : "None Yet"}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {latestBackup ? formatDateTime(latestBackup.createdAt) : "Ready to create"}
          </p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Protection</span>
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">Encrypted</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Tamper-proof verified</p>
        </div>

        <div className="p-3 bg-white border border-slate-300 rounded-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-medium">Access Level</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-slate-900">Administrator</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Restricted access</p>
        </div>
      </div>

      {/* Main Filter Bar */}
      <SearchFilters
        searchPlaceholder="Search backup filename, initiator email, or type..."
        searchValue={search}
        onSearchChange={handleSearchChange}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onReset={handleReset}
        filters={[
          {
            key: "status",
            label: "Status",
            placeholder: "All Statuses",
            options: [
              { value: "SUCCESS", label: "Completed" },
              { value: "FAILED", label: "Failed" },
              { value: "IN_PROGRESS", label: "In Progress" },
            ],
          },
        ]}
      />

      {/* Status & Date Quick Filter Toolbar */}
      <div className="bg-white p-3 border border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Status Toggle Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-600">Status:</span>
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
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors rounded-xs cursor-pointer ${
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
                className={`px-2 py-0.5 text-[11px] font-medium transition-colors rounded-xs cursor-pointer ${
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

      {/* Backup Records Table */}
      <div className="border border-slate-300 bg-white shadow-xs">
        <div className="px-3.5 py-2.5 border-b border-slate-300 flex items-center justify-between bg-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Backup History
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
            title="No backups created yet"
            description="Create a backup to protect candidate records, jobs, and applications."
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsConfirmOpen(true)}
                disabled={triggerBackupMutation.isPending}
              >
                Create Backup
              </Button>
            }
          />
        ) : filteredBackups.length === 0 ? (
          <EmptyState
            title="No backups match your filters"
            description="Try changing your search keywords, status filter, or date range."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold text-[11px] border-b border-slate-300">
                <tr>
                  <th className="px-3.5 py-2.5">Date Created</th>
                  <th className="px-3.5 py-2.5">File Name</th>
                  <th className="px-3.5 py-2.5">File Size</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Created By</th>
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
                      <div className="flex items-center gap-1.5 group">
                        <span className="font-mono text-xs text-slate-900">{b.filename}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setRenameTarget(b);
                            setRenameInput(b.filename.replace(/\.enc\.gz$/, ""));
                          }}
                          className="text-slate-400 hover:text-teal-700 p-0.5 rounded cursor-pointer opacity-70 group-hover:opacity-100 transition-opacity"
                          title="Rename Backup"
                          aria-label={`Rename backup ${b.filename}`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
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
                        {b.status === "SUCCESS" ? "Completed" : b.status === "FAILED" ? "Failed" : "In Progress"}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700">
                      {b.initiatedBy?.email || "System"}
                    </td>
                    <td className="px-3.5 py-2.5 text-right">
                      {b.status === "SUCCESS" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<RotateCcw className="w-3 h-3 text-amber-600" />}
                            onClick={() => {
                              setRestoreTarget({ mode: "RECORD", backup: b });
                              setRestoreConfirmInput("");
                            }}
                            disabled={restoreMutation.isPending}
                          >
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Download className="w-3 h-3" />}
                            onClick={() => handleDownload(b)}
                            disabled={downloadingId === b.id}
                          >
                            {downloadingId === b.id ? "Downloading..." : "Download"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          title="Create Database Backup"
          description="Generate a secure copy of your recruitment database for safekeeping."
          size="md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="space-y-1">
              <label className="block font-semibold text-slate-800 text-xs">
                Backup Label / Name (Optional)
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
                Leave blank to use the standard timestamped filename.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm space-y-2 text-xs">
              <span className="font-semibold text-slate-900 block">Backup Summary</span>
              <ul className="space-y-1.5 text-slate-700 list-disc list-inside">
                <li>Includes all candidates, job applications, interview notes, and system settings</li>
                <li>Encrypted and secured for administrator-only access</li>
                <li>Ready to download immediately upon completion</li>
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
                {triggerBackupMutation.isPending ? "Creating Backup..." : "Create Backup"}
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
          title="Rename Database Backup"
          description="Update the filename or label for this database snapshot."
          size="sm"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800 text-xs">
                New Backup Name
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
                The secure <span className="font-mono">.enc.gz</span> extension will be preserved automatically.
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
                {renameMutation.isPending ? "Saving..." : "Save Name"}
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
          title="Restore Database from Backup"
          description="Recover database records to the state captured in this backup file."
          size="md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Important Safety Warning</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Restoring will update all candidate, job, application, and system configuration records to match the selected backup snapshot. Any unsaved data created after this backup date will be replaced.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-sm space-y-1.5 text-xs text-slate-700">
              <span className="font-semibold text-slate-900 block">Backup Source</span>
              {restoreTarget.mode === "RECORD" ? (
                <div className="space-y-1">
                  <div><strong>File:</strong> {restoreTarget.backup.filename}</div>
                  <div><strong>Size:</strong> {formatBytes(restoreTarget.backup.sizeBytes)}</div>
                  <div><strong>Created:</strong> {formatDateTime(restoreTarget.backup.createdAt)}</div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div><strong>Uploaded File:</strong> {restoreTarget.file.name}</div>
                  <div><strong>Size:</strong> {formatBytes(restoreTarget.file.size)}</div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-800 text-xs">
                To confirm, type <span className="font-mono text-amber-700 font-bold">RESTORE</span> in the box below:
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
                variant="primary"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white border-amber-700"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => restoreMutation.mutate(restoreTarget)}
                disabled={
                  restoreConfirmInput.trim().toUpperCase() !== "RESTORE" ||
                  restoreMutation.isPending
                }
              >
                {restoreMutation.isPending ? "Restoring Database..." : "Restore Database"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};