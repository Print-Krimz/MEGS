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
        /^Invalid verification code\. \d{1,2} attempts? remaining\.$/.test(message) ||
        /^Headcount can't be lower than the \d{1,6} already deployed\.$/.test(message) ||
        /^An application in [A-Z_]{3,30} cannot be archived$/.test(message) ||
        /^There's no upcoming (?:Initial Screening|Final Interview) to reschedule\.$/.test(message) ||
        /^Interview result is finalized \([A-Z_]{3,20}\) and can no longer be edited\. Contact an administrator to request a correction\.(?: You can also schedule a new Initial interview\.)?$/.test(message)) return message;
  }
  if (status === 401) return "Invalid or expired credentials. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested record was not found.";
  if (status === 429) return "Too many requests. Please try again later.";
  return "The request could not be completed. Check the supplied information and try again.";
};

// Only these exception class names, plus Prisma's, may appear in a log line.
const ERROR_KINDS = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "URIError", "AbortError", "TimeoutError", "ZodError", "MulterError"]);
const ERROR_CODE = /^(?:P\d{4}|E[A-Z0-9_]{2,30}|[A-Z][A-Z0-9_]{2,40}|[A-Za-z]{1,20}\.[A-Za-z_]{1,30})$/;
const PROVIDERS = [
  ["prisma", /^PrismaClient/],
  ["supabase", /^(?:Auth|Storage|Postgrest|Functions)[A-Za-z]*Error$/],
  ["gemini", /^(?:GoogleGenerativeAI|GoogleGenAI|ApiError|ClientError)/],
] as const;

/**
 * Bounded, allowlisted facts about an exception: class name, short error code, HTTP status and
 * provider family. Messages, stacks and any other payload are never read, so nothing sensitive
 * can reach a log line through here.
 */
export const safeDiagnostic = (error: unknown): string => {
  if (!error || typeof error !== "object") return "";
  const source = error as { name?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const name = typeof source.name === "string" ? source.name.slice(0, 60) : "";
  const provider = PROVIDERS.find(([, pattern]) => pattern.test(name))?.[0];
  const parts: string[] = [];
  if (ERROR_KINDS.has(name) || provider) parts.push(`kind=${name.replace(/[^A-Za-z]/g, "")}`);
  if (typeof source.code === "string" && ERROR_CODE.test(source.code)) parts.push(`cause=${source.code}`);
  const http = typeof source.status === "number" ? source.status : source.statusCode;
  if (typeof http === "number" && Number.isInteger(http) && http >= 100 && http <= 599) parts.push(`http=${http}`);
  if (provider) parts.push(`via=${provider}`);
  return parts.join(" ");
};

/** Logs a safe, redacted line and returns the reference. Pass `reference` to reuse an existing one. */
export const safeLogError = (operation: string, error: unknown, reference: string = randomUUID()): string => {
  const detail = safeDiagnostic(error);
  console.error(`[${redactSensitiveText(operation)}] Request failed; reference ${reference}${detail ? `; ${detail}` : ""}`);
  return reference;
};

let fatalHandlersInstalled = false;
/**
 * A fatal process error leaves unknown state, so log one safe line and exit nonzero after a short
 * flush window; the platform restarts the process. Handled request errors never reach here.
 */
export const installFatalErrorHandlers = (flushMs = 200): void => {
  if (fatalHandlersInstalled) return;
  fatalHandlersInstalled = true;
  const fail = (operation: string) => (error: unknown) => {
    safeLogError(operation, error);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), flushMs);
  };
  process.on("unhandledRejection", fail("Unhandled rejection"));
  process.on("uncaughtException", fail("Uncaught exception"));
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
