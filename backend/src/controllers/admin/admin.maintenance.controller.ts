import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  startDatabaseBackupInBackground,
  listDatabaseBackups,
  renameDatabaseBackup,
  getBackupDownloadStream,
  startRestoreInBackground,
  listDatabaseRestores,
  cancelMaintenance,
  MaintenanceBusyError,
} from "../../services/admin/backup.service.js";

const errorStatus = (err: unknown, fallback: number) => (err instanceof MaintenanceBusyError ? 409 : fallback);

export const listBackupsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const backups = await listDatabaseBackups(isNaN(limit) ? 50 : limit);
    sendSuccess(res, "Database backups retrieved successfully", backups);
  } catch (err: any) {
    sendError(res, err.message || "Failed to retrieve database backups", 500);
  }
};

export const triggerBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const customName = req.body?.customName ? String(req.body.customName).trim() : undefined;
    const backup = await startDatabaseBackupInBackground(userId, "MANUAL", customName);
    sendSuccess(
      res,
      "Database backup started",
      {
        ...backup,
        sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : null,
      },
      202
    );
  } catch (err: any) {
    sendError(res, err.message || "Failed to execute database backup routine", errorStatus(err, 500));
  }
};

export const renameBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      sendError(res, "Please provide a valid backup name.", 400);
      return;
    }
    const updatedBackup = await renameDatabaseBackup(String(id), name.trim(), userId);
    sendSuccess(res, "Database backup renamed successfully.", updatedBackup);
  } catch (err: any) {
    const status = err?.message === "Database backup record not found." ? 404 : 500;
    sendError(res, err.message || "Failed to rename database backup.", status);
  }
};

export const downloadBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { stream, filename, contentType, sizeBytes } = await getBackupDownloadStream(String(id), userId);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    if (sizeBytes) {
      res.setHeader("Content-Length", sizeBytes);
    }

    stream.pipe(res);
  } catch (err: any) {
    sendError(res, "Backup snapshot not found", 404);
  }
};

export const listRestoresHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const restores = await listDatabaseRestores(isNaN(limit) ? 20 : limit);
    sendSuccess(res, "Database restores retrieved successfully", restores);
  } catch (err: any) {
    sendError(res, err.message || "Failed to retrieve database restores", 500);
  }
};

export const restoreDatabaseBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const restore = await startRestoreInBackground({ backupId: String(id) }, userId);
    sendSuccess(res, "Database restore started.", restore, 202);
  } catch (err: any) {
    sendError(res, err.message || "Failed to restore database backup.", errorStatus(err, 500));
  }
};

export const restoreUploadedBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const file = req.file;
    if (!file || !file.buffer) {
      sendError(res, "Please upload a valid encrypted backup file (.enc.gz).", 400);
      return;
    }
    const restore = await startRestoreInBackground({ buffer: file.buffer, filename: file.originalname || "uploaded-backup.enc.gz" }, userId);
    sendSuccess(res, "Database restore started.", restore, 202);
  } catch (err: any) {
    sendError(res, err.message || "Failed to restore uploaded backup file.", errorStatus(err, 500));
  }
};

export const cancelMaintenanceHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const result = await cancelMaintenance(userId);
    sendSuccess(res, "Maintenance jobs cancelled successfully", result);
  } catch (err: any) {
    sendError(res, err.message || "Failed to cancel maintenance jobs", 500);
  }
};
