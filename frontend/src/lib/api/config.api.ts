import { api } from "./client";

export interface GlobalConfig {
  MATCH_THRESHOLD: number;
  matchThreshold?: number;
  onlineMeetingAutoEnabled?: boolean;
}

export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  const data = await api.get<GlobalConfig>("/api/config");
  return data;
};
