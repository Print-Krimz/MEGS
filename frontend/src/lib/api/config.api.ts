import { api } from "./client";

export interface GlobalConfig {
  MATCH_THRESHOLD: number;
  matchThreshold?: number;
}

export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  const data = await api.get<GlobalConfig>("/config");
  return data;
};
