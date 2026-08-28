import { toast } from "sonner";
import { ApiError } from "./api/client";

/**
 * Formats any error into a clean, human-readable string suitable for end users.
 * Strips technical stack traces, database details, internal server errors, etc.
 */
export function formatErrorMessage(error: unknown): string {
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  // Handle TypeError (e.g. Failed to fetch, Network Error)
  if (error instanceof TypeError) {
    if (error.message.includes("fetch") || error.message.includes("Network")) {
      return "Unable to connect to the recruitment server. Please check your internet connection.";
    }
  }

  // Handle ApiError with specific status codes
  if (error instanceof ApiError) {
    if (error.status >= 500) {
      return "A server error occurred. Please try again later or contact support if the issue persists.";
    }

    if (error.status === 401) {
      if (error.message && error.message.toLowerCase() !== "unauthorized") {
        return cleanTechnicalPhrases(error.message);
      }
      return "Your session has expired or you are unauthorized. Please sign in again.";
    }

    if (error.status === 403) {
      if (error.message && error.message.toLowerCase() !== "forbidden") {
        return cleanTechnicalPhrases(error.message);
      }
      return "You do not have permission to perform this action.";
    }

    if (error.message) {
      return cleanTechnicalPhrases(error.message);
    }
  }

  // Generic Error instance
  if (error instanceof Error) {
    const rawMsg = error.message;
    if (rawMsg.includes("Failed to fetch") || rawMsg.includes("NetworkError")) {
      return "Unable to connect to the recruitment server. Please check your internet connection.";
    }
    return cleanTechnicalPhrases(rawMsg);
  }

  if (typeof error === "string") {
    return cleanTechnicalPhrases(error);
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Strips prisma, postgres, stack traces, and developer jargon from user-facing strings.
 */
function cleanTechnicalPhrases(message: string): string {
  if (!message) return "An unexpected error occurred. Please try again.";

  // If message contains database/Prisma keywords
  if (
    message.includes("prisma.") ||
    message.includes("invocation:") ||
    message.includes("Unique constraint failed") ||
    message.includes("Foreign key constraint") ||
    message.includes("database query")
  ) {
    if (message.includes("Unique constraint") || message.includes("Unique constraint failed")) {
      return "A record with this information already exists in the system.";
    }
    return "A data processing error occurred. Please check your inputs and try again.";
  }

  // Strip technical headers or prefixes like "Error: ", "API Error 400: "
  let cleaned = message.replace(/^Error:\s*/i, "").replace(/^API Error\s*\d*:\s*/i, "");

  // If too long or contains stack trace indicators
  if (cleaned.length > 300 || (cleaned.includes("at ") && cleaned.includes("\n"))) {
    cleaned = cleaned.split("\n")[0];
  }

  return cleaned.trim() || "An unexpected error occurred. Please try again.";

}

/**
 * Standardized feedback helper for MEGS.
 * Wraps sonner toasts with consistent title, description, styling, and human-readable error formatting.
 */
export const notify = {
  success: (title: string, description?: string) => {
    return toast.success(title, description ? { description } : undefined);
  },

  error: (title: string, error?: unknown) => {
    const description = formatErrorMessage(error);
    return toast.error(title, { description });
  },

  warning: (title: string, description?: string) => {
    return toast.warning(title, description ? { description } : undefined);
  },

  info: (title: string, description?: string) => {
    return toast.info(title, description ? { description } : undefined);
  },

  loading: (title: string, description?: string) => {
    return toast.loading(title, description ? { description } : undefined);
  },

  dismiss: (id?: string | number) => {
    toast.dismiss(id);
  },
};
