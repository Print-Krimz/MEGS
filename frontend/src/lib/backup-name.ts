import type { DatabaseBackupRecord } from "./types/admin.types";

// Older backups without a custom label still have a readable, stable name.
export function backupDisplayName(backup: Pick<DatabaseBackupRecord, "displayName" | "createdAt">): string {
  return backup.displayName?.trim() || `Backup ${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(new Date(backup.createdAt))}`;
}

export function backupDownloadName(backup: Pick<DatabaseBackupRecord, "displayName" | "createdAt">): string {
  const label = backupDisplayName(backup).replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "backup";
  return `${label}.enc.gz`;
}
