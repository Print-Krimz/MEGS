import { supabase } from '../supabase';
import type { ApiResponse } from '../types/api';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // Ignore Supabase session errors in mock/offline test environments
  }
  return localStorage.getItem('megs_access_token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const result = isJson ? await response.json() : null;

    if (!response.ok) {
      const errorMessage =
        result?.message || result?.error || `Request failed with status ${response.status}`;

      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }

      throw new ApiError(errorMessage, response.status, result);
    }

    return result as ApiResponse<T>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network request failed',
      0
    );
  }
}

export const apiClient = {
  get: <T>(url: string, params?: Record<string, string | number | boolean | undefined | null>): Promise<ApiResponse<T>> => {
    let finalUrl = url;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        finalUrl += `${url.includes('?') ? '&' : '?'}${queryString}`;
      }
    }
    return request<T>(finalUrl, { method: 'GET' });
  },

  post: <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
    return request<T>(url, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put: <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
    return request<T>(url, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  patch: <T>(url: string, body?: unknown): Promise<ApiResponse<T>> => {
    return request<T>(url, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T>(url: string): Promise<ApiResponse<T>> => {
    return request<T>(url, { method: 'DELETE' });
  },

  upload: <T>(url: string, formData: FormData, method: 'POST' | 'PATCH' | 'PUT' = 'POST'): Promise<ApiResponse<T>> => {
    return request<T>(url, {
      method,
      body: formData,
    });
  },
};
