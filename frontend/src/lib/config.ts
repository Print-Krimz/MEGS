import { useQuery } from "@tanstack/react-query";
import { getGlobalConfig, GlobalConfig } from "./api/config.api";

export const useGlobalConfig = () => {
  return useQuery<GlobalConfig>({
    queryKey: ["globalConfig"],
    queryFn: getGlobalConfig,
    staleTime: Infinity, // Configuration rarely changes without a reload
    gcTime: Infinity,
  });
};
