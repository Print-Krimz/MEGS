import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  triggerDatabaseBackupRoutine,
  listDatabaseBackups,
  renameDatabaseBackup,
  getBackupDownloadStream,
  restoreDatabaseBackupById,
  restoreDatabaseBackupFromBuffer,
} from "../../services/admin/backup.service.js";

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
    const backup = await triggerDatabaseBackupRoutine(userId, "MANUAL", customName);
    sendSuccess(
      res,
      "Database backup created successfully",
      {
        ...backup,
        sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : null,
      },
      201
    );
  } catch (err: any) {
    sendError(res, err.message || "Failed to execute database backup routine", 500);
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
    sendError(res, err.message || "Failed to rename database backup.", 500);
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
    res.status(404).json({ error: err.message || "Backup snapshot not found" });
  }
};

export const restoreDatabaseBackupHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const result = await restoreDatabaseBackupById(String(id), userId);
    sendSuccess(res, "Database restored successfully.", result);
  } catch (err: any) {
    sendError(res, err.message || "Failed to restore database backup.", 500);
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
    const result = await restoreDatabaseBackupFromBuffer(file.buffer, userId);
    sendSuccess(res, "Database restored from uploaded backup file successfully.", result);
  } catch (err: any) {
    sendError(res, err.message || "Failed to restore uploaded backup file.", 500);
  }
};