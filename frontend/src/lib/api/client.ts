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

const API_BASE = import.meta.env.VITE_API_URL || "";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("access_token");

  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };

  const isPublicAuthPath =
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/forgot-password") ||
    path.startsWith("/api/auth/reset-password") ||
    path.startsWith("/api/auth/setup-account");

  if (token && !isPublicAuthPath) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Set application/json only if body is NOT FormData
  if (!(options?.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

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
      if (!isPublicAuthPath) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
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
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error instanceof Error ? error.message : "Network error");
  }
}

export async function apiRequestBlob(
  path: string,
  options?: RequestInit
): Promise<Blob> {
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

    if (res.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
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
    if (error instanceof ApiError) {
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

