import type { Request, Response } from "express";
import { getSettings, SettingsAccessError, updateProfile } from "../../services/core/settings.service.js";
import { sendError, sendSuccess } from "../../utils/response.js";

export const getSettingsHandler = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, "Settings retrieved", await getSettings(req.user!.id));
  } catch (error) {
    sendError(res, error instanceof SettingsAccessError ? error.message : "Unable to retrieve settings", error instanceof SettingsAccessError ? 403 : 500, error);
  }
};

export const updateProfileHandler = async (req: Request, res: Response) => {
  try {
    sendSuccess(res, "Name updated", await updateProfile(req.user!.id, req.body.displayName));
  } catch (error) {
    sendError(res, error instanceof SettingsAccessError ? error.message : "Unable to update name", error instanceof SettingsAccessError ? 403 : 500, error);
  }
};
