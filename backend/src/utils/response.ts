import type { Response } from "express";
import { publicErrorMessage, redactSensitiveText, safeLogError } from "../security/errors.js";

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
  const status = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
  const reference = status >= 500 ? safeLogError(`API response ${status}`, error || message) : undefined;
  const validation = message === "Validation failed" && status === 400 && error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)
    ? error.errors.slice(0, 50).map((issue: any) => ({
      field: String(issue.field || "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120),
      message: redactSensitiveText(String(issue.message || "Invalid value")).slice(0, 300),
    })) : undefined;
  return res.status(status).json({
    success: false,
    message: publicErrorMessage(message, status),
    ...(validation ? { error: { errors: validation } } : {}),
    ...(reference ? { reference } : {}),
  });
};
