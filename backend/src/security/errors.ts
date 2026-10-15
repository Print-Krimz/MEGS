import { randomUUID } from "node:crypto";
import { publicMessages } from "./public-messages.js";

export const redactSensitiveText = (value: string): string => value
  .replace(/\b(?:https?|postgres(?:ql)?|redis(?:s)?):\/\/[^\s<>"']+/gi, "[REDACTED URL]")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED EMAIL]")
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, "[REDACTED JWT]")
  .replace(/(Bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
  .replace(/(["']?(?:token|password|secret|api[_-]?key|otp|code)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1[REDACTED]")
  .replace(/((?:token|password|secret|api[_-]?key|otp|code)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]")
  .replace(/(?<![\w-])\+?\d{10,15}(?![\w-])/g, "[REDACTED NUMBER]")
  .replace(/\b\d{6}\b/g, "******");

export const publicErrorMessage = (message: unknown, status: number): string => {
  if (status >= 500) return "The request could not be completed. Please try again later.";
  if (typeof message === "string") {
    if (publicMessages.has(message)) return message;
    if (/^Please wait \d{1,5} seconds before requesting another code\.$/.test(message) ||
        /^Invalid verification code\. \d{1,2} attempts? remaining\.$/.test(message)) return message;
  }
  if (status === 401) return "Invalid or expired credentials. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested record was not found.";
  if (status === 429) return "Too many requests. Please try again later.";
  return "The request could not be completed. Check the supplied information and try again.";
};

export const safeLogError = (operation: string, _error: unknown): string => {
  const correlationId = randomUUID();
  // Keep operation and correlation data; omit exception payloads and stack arguments.
  console.error(`[${redactSensitiveText(operation)}] Request failed; reference ${correlationId}`);
  return correlationId;
};

export const installSafeErrorLogging = (): void => {
  for (const level of ["error", "warn"] as const) {
    const original = console[level].bind(console);
    console[level] = (...values: unknown[]) => original(...values.map(value => {
      if (typeof value === "string") return redactSensitiveText(value);
      if (typeof value === "number" || typeof value === "boolean") return value;
      return "[Diagnostic payload omitted]";
    }));
  }
};
