import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/client";

export interface SecurityControls {
  mfaDisabled: boolean;
  otpDisabled: boolean;
  rateLimitDisabled: boolean;
  captchaDisabled?: boolean;
  /** Demo only (DEMO_ALLOW_EARLY_END): assignments can be ended before their start date. */
  earlyAssignmentEndAllowed?: boolean;
}

export const useSecurityControls = (enabled = true) => useQuery({
  queryKey: ["security-controls"],
  queryFn: () => api.get<SecurityControls>("/api/config/security"),
  enabled,
  // Focus refetch picks up an admin toggle; no timer.
  staleTime: 60_000,
});
