import { bumpSessionGeneration, getSessionGeneration, tokenExpiry } from "../auth/session-generation";
import type { ApiResponse, ApiErrorDetail } from "../types/api.types";

export class ApiError extends Error {
  public status: number;
  public details?: ApiErrorDetail[] | Record<string, unknown> | string;

  constructor(
    status: number,
    message: string,
    details?: ApiErrorDetail[] | Record<string, unknown> | string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function resolveApiBase(rawUrl?: string): string {
  if (!rawUrl) return "";
  return rawUrl.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

/** Absolute URL for an API path, built the same way apiRequest builds it. */
export const apiUrl = (path: string): string => `${API_BASE}${path}`;

let refreshInFlight: { generation: number; promise: Promise<boolean> } | null = null;

/**
 * Drops the credentials. Starts a new session generation only when a token was actually sent:
 * a tokenless 401 has no session to end, and bumping would reset queries into a refetch loop.
 */
function endSession(hadToken: boolean): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  if (hadToken) bumpSessionGeneration();
}

/**
 * Exchanges the stored refresh token for a new access token. One call is shared by all
 * concurrent 401s. Resolves true when a usable access token is now in localStorage.
 */
export function refreshAccessToken(staleToken: string | null): Promise<boolean> {
  const current = localStorage.getItem("access_token");
  // Another request already replaced the token this one used: just retry with it.
  if (current && staleToken && current !== staleToken) return Promise.resolve(true);

  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return Promise.resolve(false);

  const generation = getSessionGeneration();
  if (!refreshInFlight || refreshInFlight.generation !== generation) {
    const promise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const json = (await res.json()) as ApiResponse<{ access_token?: string; refresh_token?: string }>;
        const data = json?.data;
        if (!json?.success || !data?.access_token) return false;
        // The session ended or changed while refreshing: never write its tokens.
        if (generation !== getSessionGeneration()) return false;
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        window.dispatchEvent(new Event("auth-token-changed"));
        return true;
      } catch {
        return false;
      } finally {
        if (refreshInFlight?.generation === generation) refreshInFlight = null;
      }
    })();
    refreshInFlight = { generation, promise };
  }
  return refreshInFlight.promise;
}

/**
 * Refreshes a stored token that expires within 30 s, so the request goes out with a valid one
 * instead of costing a 401 round trip. A failed refresh is ignored: the request is sent anyway
 * and the 401 path handles it as before. Tokens without a readable `exp` are left alone.
 * Returns undefined (not a promise) when nothing is due, so callers add no await tick then.
 */
function refreshIfExpiring(): Promise<boolean> | undefined {
  const token = localStorage.getItem("access_token");
  const exp = tokenExpiry(token);
  return exp !== null && exp * 1000 - Date.now() < 30_000 ? refreshAccessToken(token) : undefined;
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
  _retried = false
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  const isPublicAuthPath =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/forgot-password") ||
    path.startsWith("/api/auth/reset-password") ||
    path.startsWith("/api/auth/verify-otp") ||
    path.startsWith("/api/auth/resend-otp") ||
    path.startsWith("/api/auth/setup-account") ||
    path.startsWith("/api/auth/invitation") ||
    path.startsWith("/api/auth/claim") ||
    path.startsWith("/api/public/");

  if (!_retried && !isPublicAuthPath && !headers["Authorization"] && !path.startsWith("/api/auth/logout")) {
    const refreshing = refreshIfExpiring();
    if (refreshing) await refreshing;
  }
  // Read after the refresh so the generation and token describe the same session.
  const generation = getSessionGeneration();
  const token = localStorage.getItem("access_token");

  // Only inject localStorage token if NO explicit Authorization header was passed and path is not public/isolated auth
  let injectedToken = false;
  if (token && !isPublicAuthPath && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
    injectedToken = true;
  }

  // JSON content type only for a JSON body: a bodyless GET with it forces a CORS preflight
  if (options?.body != null && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (injectedToken && generation !== getSessionGeneration()) {
      throw new DOMException("Session changed", "AbortError");
    }

    // Handle empty 204 response
    if (res.status === 204) {
      return null as unknown as T;
    }

    let json: ApiResponse<T> | null = null;
    try {
      json = (await res.json()) as ApiResponse<T>;
    } catch {
      // Body may not be JSON
    }

    // Handle 401 Unauthorized
    if (res.status === 401) {
      if (
        !isPublicAuthPath &&
        injectedToken &&
        !_retried &&
        !path.startsWith("/api/auth/logout") &&
        (await refreshAccessToken(token)) &&
        generation === getSessionGeneration()
      ) {
        return apiRequest<T>(path, options, true);
      }
      // A 401 for an older session must not clear or redirect the current one.
      if (!isPublicAuthPath && generation === getSessionGeneration()) {
        endSession(injectedToken);
        if (!window.location.pathname.startsWith("/login")) {
          const currentPath = window.location.pathname;
          const redirectParam =
            currentPath && currentPath !== "/"
              ? `?redirect=${encodeURIComponent(currentPath + window.location.search)}`
              : "";
          window.location.href = `/login${redirectParam}`;
        }
      }

      const errorMsg =
        json?.message ||
        (isPublicAuthPath ? "Invalid email or password." : "Session expired. Please log in again.");
      throw new ApiError(401, errorMsg, json?.error as ApiErrorDetail[] | undefined);
    }

    if (!res.ok || (json && !json.success)) {
      const errorMsg = json?.message || res.statusText || "An error occurred with the request.";
      throw new ApiError(res.status, errorMsg, json?.error as ApiErrorDetail[] | undefined);
    }

    return json!.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new ApiError(408, "Request timed out. Please check your connection and try again.");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (error instanceof ApiError || error instanceof TypeError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : "Network error");
  }
}

export async function apiRequestBlob(
  path: string,
  options?: RequestInit,
  _retried = false
): Promise<Blob> {
  const refreshing = _retried ? undefined : refreshIfExpiring();
  if (refreshing) await refreshing;
  const generation = getSessionGeneration();
  const token = localStorage.getItem("access_token");

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (token && generation !== getSessionGeneration()) {
      throw new DOMException("Session changed", "AbortError");
    }

    if (res.status === 401) {
      if (token && !_retried && (await refreshAccessToken(token)) && generation === getSessionGeneration()) {
        return apiRequestBlob(path, options, true);
      }
      if (generation !== getSessionGeneration()) {
        throw new ApiError(401, "Session expired. Please log in again.");
      }
      endSession(!!token);
      if (!window.location.pathname.startsWith("/login")) {
        const currentPath = window.location.pathname;
        const redirectParam =
          currentPath && currentPath !== "/"
            ? `?redirect=${encodeURIComponent(currentPath + window.location.search)}`
            : "";
        window.location.href = `/login${redirectParam}`;
      }
      throw new ApiError(401, "Session expired. Please log in again.");
    }

    if (!res.ok) {
      let errorMsg = res.statusText || "Failed to download file";
      try {
        const json = await res.json();
        if (json?.message) errorMsg = json.message;
      } catch {}
      throw new ApiError(res.status, errorMsg);
    }

    return await res.blob();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    if (error instanceof ApiError || error instanceof TypeError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : "Network error");
  }
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    apiRequest<T>(path, { method: "GET", ...options }),

  blob: (path: string, options?: RequestInit) =>
    apiRequestBlob(path, { method: "GET", ...options }),

  post: <T>(path: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    }),

  patch: <T>(path: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(path, {
      method: "PATCH",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    }),

  put: <T>(path: string, data?: unknown, options?: RequestInit) =>
    apiRequest<T>(path, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
      ...options,
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    apiRequest<T>(path, { method: "DELETE", ...options }),

  upload: <T>(path: string, formData: FormData, options?: RequestInit) =>
    apiRequest<T>(path, {
      method: "POST",
      body: formData,
      ...options,
    }),
};

