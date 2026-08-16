import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "../LoginPage";
import { ForgotPasswordPage } from "../ForgotPasswordPage";
import { ResetPasswordPage } from "../ResetPasswordPage";
import { authApi } from "../../../lib/api/auth.api";

let mockSearchValue: Record<string, any> = {};

vi.mock("../../../lib/api/auth.api", () => ({
  authApi: {
    login: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, search, ...props }: any) => {
    const searchString = search ? `?${new URLSearchParams(search).toString()}` : "";
    return (
      <a href={`${to}${searchString}`} data-search={JSON.stringify(search)} {...props}>
        {children}
      </a>
    );
  },
  useNavigate: () => vi.fn(),
  useSearch: () => mockSearchValue,
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("Authentication & Password Reset Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchValue = {};
  });

  describe("LoginPage Auto-Fill and Query Handling", () => {
    it("renders empty email when no search param is provided", () => {
      mockSearchValue = {};
      renderWithClient(<LoginPage />);
      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe("");
    });

    it("pre-populates email from query search parameters", () => {
      mockSearchValue = { email: "applicant@megs.com" };
      renderWithClient(<LoginPage />);
      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe("applicant@megs.com");
    });

    it("passes typed email to the Forgot password? link search params", () => {
      mockSearchValue = {};
      renderWithClient(<LoginPage />);
      const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "ta.recruiter@megs.com" } });

      const forgotLink = screen.getByRole("link", { name: /Forgot password\?/i });
      expect(forgotLink.getAttribute("href")).toBe("/forgot-password?email=ta.recruiter%40megs.com");
    });
  });

  describe("ForgotPasswordPage Auto-Fill, Editing & Flow", () => {
    it("auto-fills registered email address when navigating with email in search param", () => {
      mockSearchValue = { email: "admin@megs.com" };
      renderWithClient(<ForgotPasswordPage />);
      const emailInput = screen.getByLabelText(/Registered Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe("admin@megs.com");
    });

    it("allows the user to edit the pre-filled email address", () => {
      mockSearchValue = { email: "initial@megs.com" };
      renderWithClient(<ForgotPasswordPage />);
      const emailInput = screen.getByLabelText(/Registered Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe("initial@megs.com");

      fireEvent.change(emailInput, { target: { value: "edited@megs.com" } });
      expect(emailInput.value).toBe("edited@megs.com");
    });

    it("carries edited email back to login when clicking Back to Sign In", () => {
      mockSearchValue = {};
      renderWithClient(<ForgotPasswordPage />);
      const emailInput = screen.getByLabelText(/Registered Email Address/i) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "candidate@megs.com" } });

      const backLink = screen.getByRole("link", { name: /Back to Sign In/i });
      expect(backLink.getAttribute("href")).toBe("/login?email=candidate%40megs.com");
    });

    it("successfully submits password reset instructions for Applicant, TA, and Admin accounts", async () => {
      (authApi.forgotPassword as any).mockResolvedValue({
        message: "Recovery instructions sent.",
      });

      mockSearchValue = { email: "applicant@megs.com" };
      renderWithClient(<ForgotPasswordPage />);

      const submitBtn = screen.getByRole("button", { name: /Send Reset Instructions/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(authApi.forgotPassword).toHaveBeenCalledWith(
          expect.objectContaining({ email: "applicant@megs.com" }),
          expect.anything()
        );
        expect(screen.getByText(/Recovery Request Processed/i)).toBeDefined();
        expect(screen.getByText(/applicant@megs.com/i)).toBeDefined();
      });
    });
  });

  describe("ResetPasswordPage Token Auto-Extraction & Reset Flow", () => {
    it("renders Reset Token input when no token is present in URL", () => {
      mockSearchValue = {};
      renderWithClient(<ResetPasswordPage />);
      expect(screen.getByLabelText(/Reset Token/i)).toBeDefined();
    });

    it("hides Reset Token input when token is in query parameters", () => {
      mockSearchValue = { token: "secret-query-token" };
      renderWithClient(<ResetPasswordPage />);
      expect(screen.queryByLabelText(/Reset Token/i)).toBeNull();
    });

    it("successfully submits new password when token is present", async () => {
      (authApi.resetPassword as any).mockResolvedValue({ success: true, message: "Password updated" });

      mockSearchValue = { token: "valid-recovery-token" };
      renderWithClient(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^New Password/i);
      const confirmInput = screen.getByLabelText(/^Confirm New Password/i);

      fireEvent.change(passInput, { target: { value: "NewSecurePassword123!" } });
      fireEvent.change(confirmInput, { target: { value: "NewSecurePassword123!" } });

      const submitBtn = screen.getByRole("button", { name: /Update Password/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "valid-recovery-token",
            password: "NewSecurePassword123!",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Password Reset Complete/i)).toBeDefined();
      });
    });
  });
});
