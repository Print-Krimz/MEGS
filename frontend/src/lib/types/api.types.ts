export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  error?: unknown;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error?: string | ApiErrorDetail[] | Record<string, unknown>;
}

export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor?: number | string | null;
  total?: number;
}

export interface OffsetPaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
