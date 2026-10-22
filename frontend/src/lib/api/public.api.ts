import { api } from "./client";
import type {
  CheckInJob,
  CheckInSubmitBody,
  CheckInSubmitResult,
  PublicCheckInStatus,
  PublicOffer,
  PublicOfferResponseBody,
  PublicOfferResult,
  PublicTracking,
} from "../types/public.types";

/** No login. Every failure is a 404, so callers show one "link no longer works" state. */
export const publicApi = {
  getTracking: (code: string, token: string, options?: RequestInit) =>
    api.get<PublicTracking>(
      `/api/public/track/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`,
      options
    ),

  getCheckInJobs: (q: string, options?: RequestInit) =>
    api.get<{ jobs: CheckInJob[] }>(`/api/public/check-in/jobs?q=${encodeURIComponent(q)}`, options),

  submitCheckIn: (body: CheckInSubmitBody) =>
    api.post<CheckInSubmitResult>("/api/public/check-in", body, {
      headers: { "x-turnstile-token": body.turnstileToken },
    }),

  getCheckInStatus: (publicId: string, token: string, options?: RequestInit) =>
    api.get<PublicCheckInStatus>(
      `/api/public/check-in/${encodeURIComponent(publicId)}?token=${encodeURIComponent(token)}`,
      options
    ),

  getOffer: (id: number | string, token: string, options?: RequestInit) =>
    api.get<PublicOffer>(`/api/public/offers/${encodeURIComponent(String(id))}?token=${encodeURIComponent(token)}`, options),

  respondOffer: (id: number | string, body: PublicOfferResponseBody) =>
    api.post<PublicOfferResult>(`/api/public/offers/${encodeURIComponent(String(id))}/respond`, body),

  claimStart: (phone: string, turnstileToken?: string) =>
    api.post<{ message: string }>(
      "/api/auth/claim/start",
      { phone, turnstileToken: turnstileToken ?? "" },
      turnstileToken ? { headers: { "x-turnstile-token": turnstileToken } } : undefined
    ),

  claimVerify: (phone: string, otp: string) =>
    api.post<{ claimToken: string }>("/api/auth/claim/verify", { phone, otp }),

  claimEmailCode: (claimToken: string, email: string) =>
    api.post<{ message?: string }>("/api/auth/claim/email-code", { claimToken, email }),

  claimComplete: (body: { claimToken: string; password: string; email?: string; emailOtp?: string }) =>
    api.post<{ message?: string }>("/api/auth/claim/complete", body),
};
