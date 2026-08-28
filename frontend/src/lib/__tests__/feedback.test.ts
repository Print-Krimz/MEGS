import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatErrorMessage, notify } from "../feedback";
import { ApiError } from "../api/client";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe("feedback system & error formatting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatErrorMessage", () => {
    it("returns friendly message for ApiError with status 500", () => {
      const err = new ApiError(500, "DATABASE_ERROR: connection pool timeout");
      const msg = formatErrorMessage(err);
      expect(msg).toBe("A server error occurred. Please try again later or contact support if the issue persists.");
    });

    it("returns clean message for ApiError with status 400 or 409", () => {
      const err = new ApiError(409, "Candidate has already been endorsed to this client.");
      const msg = formatErrorMessage(err);
      expect(msg).toBe("Candidate has already been endorsed to this client.");
    });

    it("returns network error message when TypeError / fetch failed", () => {
      const err = new TypeError("Failed to fetch");
      const msg = formatErrorMessage(err);
      expect(msg).toBe("Unable to connect to the recruitment server. Please check your internet connection.");
    });

    it("returns specific message for 401 if provided", () => {
      const err = new ApiError(401, "Invalid email or password");
      const msg = formatErrorMessage(err);
      expect(msg).toBe("Invalid email or password");
    });

    it("returns default session expired message for generic 401 Unauthorized", () => {
      const err = new ApiError(401, "Unauthorized");
      const msg = formatErrorMessage(err);
      expect(msg).toBe("Your session has expired or you are unauthorized. Please sign in again.");
    });
  });

  describe("notify helpers", () => {
    it("calls toast.success with title and description", () => {
      notify.success("Application Submitted", "Your candidacy has been received.");
      expect(toast.success).toHaveBeenCalledWith("Application Submitted", {
        description: "Your candidacy has been received.",
      });
    });

    it("calls toast.error with formatted message", () => {
      const err = new ApiError(404, "Job position no longer available.");
      notify.error("Action Failed", err);
      expect(toast.error).toHaveBeenCalledWith("Action Failed", {
        description: "Job position no longer available.",
      });
    });

    it("calls toast.warning with title and description", () => {
      notify.warning("Session Expiring", "Please save your draft.");
      expect(toast.warning).toHaveBeenCalledWith("Session Expiring", {
        description: "Please save your draft.",
      });
    });
  });
});
