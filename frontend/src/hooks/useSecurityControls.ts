import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/client";

export interface SecurityControls {
  mfaDisabled: boolean;
  otpDisabled: boolean;
  rateLimitDisabled: boolean;
}

export const useSecurityControls = (enabled = true) => useQuery({
  queryKey: ["security-controls"],
  queryFn: () => api.get<SecurityControls>("/api/config/security"),
  enabled,
  refetchInterval: enabled ? 5000 : false,
  staleTime: 0,
});
