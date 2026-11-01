import { api } from "./client";
import type { AccountSettings, UpdateStaffProfileRequest } from "../types/settings.types";

export const settingsApi = {
  getSettings: (options?: { signal?: AbortSignal }) =>
    api.get<AccountSettings>("/api/settings", options),
  updateProfile: (data: UpdateStaffProfileRequest, options?: { signal?: AbortSignal }) =>
    api.patch<{ displayName: string }>("/api/settings/profile", data, options),
};
