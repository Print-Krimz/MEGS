import type { Response } from "express";

// Standardized API response format helpers:
// Success: { success: true, message, data }
// Error:   { success: false, message, error? }

export const sendSuccess = (
  res: Response,
  message: string,
  data: unknown = null,
  statusCode: number = 200
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  error: unknown = null
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(error !== null && error !== undefined ? { error } : {}),
  });
};
