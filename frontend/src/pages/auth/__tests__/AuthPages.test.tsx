import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "../LoginPage";
import { RegisterPage } from "../RegisterPage";
import { ForgotPasswordPage } from "../ForgotPasswordPage";
import { ResetPasswordPage } from "../ResetPasswordPage";
import { SetupAccountPage } from "../SetupAccountPage";
import { authApi } from "../../../lib/api/auth.api";

let mockSearchValue: Record<string, any> = {};

vi.mock("../../../lib/api/auth.api", () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    verifyOtp: vi.fn(),
    resendOtp: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    getInvitationDetails: vi.fn(),
    setupAccount: vi.fn(),
    enrollMfa: vi.fn(),
    verifyMfaEnrollment: vi.fn(),
    verifyMfaLogin: vi.fn(),
    verifyMfaRecovery: vi.fn(),
    resetUserMfa: vi.fn(),
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
  useParams: () => ({}),
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

describe("Authentication & 6-Digit OTP Verification Flow", () => {
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

    it("keeps password recovery reachable by keyboard", () => {
      renderWithClient(<LoginPage />);

      expect(screen.getByRole("link", { name: /Forgot password\?/i }).tabIndex).not.toBe(-1);
    });

    it("opens MfaChallengeModal when backend returns mfaRequired", async () => {
      (authApi.login as any).mockResolvedValue({
        mfaRequired: true,
        factorId: "factor-totp-123",
        challengeId: "challenge-456",
        tempToken: "temp-session-token",
        user: { id: "admin-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
      });

      renderWithClient(<LoginPage />);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);

      fireEvent.change(emailInput, { target: { value: "admin@megs.ph" } });
      fireEvent.change(passInput, { target: { value: "AdminSecret123!" } });
      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalled();
        expect(screen.getByText(/Two-Factor Authentication/i)).toBeDefined();
      });

    });

    it("opens MfaSetupModal when backend returns mfaSetupRequired for un-enrolled staff", async () => {
      (authApi.login as any).mockResolvedValue({
        mfaSetupRequired: true,
        tempToken: "temp-enrollment-token",
        user: { id: "admin-2", email: "admin2@megs.ph", role: "ADMINISTRATOR" },
      });

      (authApi.enrollMfa as any).mockResolvedValue({
        factorId: "factor-new-789",
        type: "totp",
        qrCode: "data:image/svg+xml;base64,mockqr",
        secret: "ABCDEF1234567890",
        uri: "otpauth://totp/MEGS",
      });

      renderWithClient(<LoginPage />);
      const emailInput = screen.getByLabelText(/Email Address/i);
      const passInput = screen.getByLabelText(/Password/i);

      fireEvent.change(emailInput, { target: { value: "admin2@megs.ph" } });
      fireEvent.change(passInput, { target: { value: "AdminSecret123!" } });
      fireEvent.click(screen.getByRole("button", { name: /^Sign In$/i }));

      await waitFor(() => {
        expect(screen.getByText(/Set Up Multi-Factor Authentication/i)).toBeDefined();
        expect(screen.getByText("ABCDEF1234567890")).toBeDefined();
        expect(screen.getByRole("button", { name: /Verify & Enable MFA/i })).toBeDefined();
      });
    });
  });


  describe("RegisterPage Registration & 6-Digit OTP Verification Flow", () => {
    it("renders registration form initially", () => {
      renderWithClient(<RegisterPage />);
      expect(screen.getByLabelText(/^Email Address/i)).toBeDefined();
      expect(screen.getByLabelText(/^Password/i)).toBeDefined();
      expect(screen.getByLabelText(/^Confirm Password/i)).toBeDefined();
    });

    it("submits registration and transitions to 6-digit OTP verification screen", async () => {
      (authApi.register as any).mockResolvedValue({
        id: "user-123",
        email: "candidate@example.com",
        accountStatus: "PENDING_VERIFICATION",
      });

      renderWithClient(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/^Email Address/i), {
        target: { value: "candidate@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Password/i), {
        target: { value: "Password123!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
        target: { value: "Password123!" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Create Candidate Account/i }));

      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "candidate@example.com",
            password: "Password123!",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Enter 6-Digit Code/i)).toBeDefined();
        expect(screen.getByText("ca*******@example.com")).toBeDefined();
      });
    });

    it("submits OTP and renders success activation screen", async () => {
      (authApi.register as any).mockResolvedValue({
        id: "user-123",
        email: "candidate@example.com",
        accountStatus: "PENDING_VERIFICATION",
      });
      (authApi.verifyOtp as any).mockResolvedValue({
        message: "Email verified successfully.",
      });

      renderWithClient(<RegisterPage />);

      // Step 1: Register
      fireEvent.change(screen.getByLabelText(/^Email Address/i), {
        target: { value: "candidate@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Password/i), {
        target: { value: "Password123!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
        target: { value: "Password123!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Create Candidate Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Enter 6-Digit Code/i)).toBeDefined();
        expect(screen.getByText("ca*******@example.com")).toBeDefined();
      });

      // Step 2: Enter OTP
      const otpInput = screen.getByLabelText(/6-Digit Verification Code/i);
      fireEvent.change(otpInput, { target: { value: "543210" } });

      const verifyBtn = screen.getByRole("button", { name: /Verify & Activate Account/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(authApi.verifyOtp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "candidate@example.com",
            otp: "543210",
            purpose: "REGISTRATION",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Email Verified Successfully/i)).toBeDefined();
        expect(screen.getByText("ca*******@example.com")).toBeDefined();
      });
    });
  });

  describe("ForgotPasswordPage 3-Step OTP Recovery Flow", () => {
    it("locks the email input as readOnly and displays masked email when navigated with email query param", () => {
      mockSearchValue = { email: "fohol97207@bocably.com" };
      renderWithClient(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/Registered Email Address/i) as HTMLInputElement;
      expect(emailInput.value).toBe("fo********@bocably.com");
      expect(emailInput.readOnly).toBe(true);
    });

    it("submits email and advances to OTP entry step displaying masked email", async () => {
      (authApi.forgotPassword as any).mockResolvedValue({
        message: "Verification code sent.",
      });

      renderWithClient(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/Registered Email Address/i);
      fireEvent.change(emailInput, { target: { value: "forgot@megs.com" } });

      fireEvent.click(screen.getByRole("button", { name: /Send Verification Code/i }));

      await waitFor(() => {
        expect(authApi.forgotPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "forgot@megs.com",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Enter 6-Digit Code/i)).toBeDefined();
        expect(screen.getByText("fo****@megs.com")).toBeDefined();
      });
    });

    it("verifies OTP and proceeds to new password step, then resets password", async () => {
      (authApi.forgotPassword as any).mockResolvedValue({ message: "Sent" });
      (authApi.verifyOtp as any).mockResolvedValue({
        message: "Verified",
        resetToken: "valid-session-reset-token-64-char",
      });
      (authApi.resetPassword as any).mockResolvedValue({
        message: "Password has been reset successfully.",
      });

      renderWithClient(<ForgotPasswordPage />);

      // Step 1: Submit email
      fireEvent.change(screen.getByLabelText(/Registered Email Address/i), {
        target: { value: "forgot@megs.com" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Send Verification Code/i }));

      await waitFor(() => {
        expect(screen.getByText(/Enter 6-Digit Code/i)).toBeDefined();
      });

      // Step 2: Verify OTP
      const otpInput = screen.getByLabelText(/6-Digit Verification Code/i);
      fireEvent.change(otpInput, { target: { value: "654321" } });
      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      await waitFor(() => {
        expect(authApi.verifyOtp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "forgot@megs.com",
            otp: "654321",
            purpose: "PASSWORD_RESET",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Set New Password/i)).toBeDefined();
      });

      // Step 3: Enter new password
      fireEvent.change(screen.getByLabelText(/^New Password/i), {
        target: { value: "NewSuperPass123!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), {
        target: { value: "NewSuperPass123!" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Update Password/i }));

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "valid-session-reset-token-64-char",
            password: "NewSuperPass123!",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Password Reset Complete/i)).toBeDefined();
      });
    });
  });

  describe("ResetPasswordPage Direct URL Token Flow", () => {
    it("successfully submits new password when token is in query params", async () => {
      (authApi.resetPassword as any).mockResolvedValue({ success: true, message: "Password updated" });

      mockSearchValue = { token: "direct-url-token" };
      renderWithClient(<ResetPasswordPage />);

      fireEvent.change(screen.getByLabelText(/^New Password/i), {
        target: { value: "NewSecurePassword123!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), {
        target: { value: "NewSecurePassword123!" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Update Password/i }));

      await waitFor(() => {
        expect(authApi.resetPassword).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "direct-url-token",
            password: "NewSecurePassword123!",
          }),
          expect.anything()
        );
        expect(screen.getByText(/Password Reset Complete/i)).toBeDefined();
      });
    });
  });

  describe("SetupAccountPage Invitation & Activation Flow", () => {
    it("fetches invitation details and renders masked email for valid token", async () => {
      (authApi.getInvitationDetails as any).mockResolvedValue({
        valid: true,
        email: "dresden.recruiter@gmail.com",
        maskedEmail: "dr***************@gmail.com",
        role: "TALENT_ACQUISITION",
        expiresAt: "2026-08-27T00:00:00Z",
      });

      renderWithClient(<SetupAccountPage />);

      const tokenInput = screen.getByLabelText(/Invitation Token/i);
      fireEvent.change(tokenInput, { target: { value: "valid-invite-token-123" } });

      await waitFor(() => {
        expect(screen.getByText("dr***************@gmail.com")).toBeDefined();
        expect(screen.getByText(/Invited Email \(Locked\)/i)).toBeDefined();
        expect(screen.getByText("TA SPECIALIST")).toBeDefined();
      });
    });

    it("displays error card when invitation token is invalid or expired", async () => {
      (authApi.getInvitationDetails as any).mockRejectedValue(
        new Error("This invitation has expired. Please ask your administrator to resend an invitation.")
      );

      renderWithClient(<SetupAccountPage />);

      const tokenInput = screen.getByLabelText(/Invitation Token/i);
      fireEvent.change(tokenInput, { target: { value: "expired-token-123" } });

      await waitFor(() => {
        expect(screen.getByText(/Invitation Invalid or Expired/i)).toBeDefined();
        expect(
          screen.getByText(/This invitation has expired. Please ask your administrator to resend an invitation./i)
        ).toBeDefined();
        expect(screen.getByText(/Return to Sign In/i)).toBeDefined();
      });
    });

    it("submits password setup and transitions when password is valid", async () => {
      (authApi.getInvitationDetails as any).mockResolvedValue({
        valid: true,
        email: "dresden.recruiter@gmail.com",
        maskedEmail: "dr***************@gmail.com",
        role: "TALENT_ACQUISITION",
        expiresAt: "2026-08-27T00:00:00Z",
      });
      (authApi.setupAccount as any).mockResolvedValue({
        message: "Account setup completed successfully.",
        user: { id: "ta-1", email: "dresden.recruiter@gmail.com", role: "TALENT_ACQUISITION", accountStatus: "ACTIVE" },
      });

      renderWithClient(<SetupAccountPage />);

      const tokenInput = screen.getByLabelText(/Invitation Token/i);
      fireEvent.change(tokenInput, { target: { value: "valid-token-xyz" } });

      await waitFor(() => {
        expect(screen.getByText("dr***************@gmail.com")).toBeDefined();
      });

      fireEvent.change(screen.getByLabelText(/^Set Password/i), {
        target: { value: "NewSecurePassword123!" },
      });
      fireEvent.change(screen.getByLabelText(/^Confirm Password/i), {
        target: { value: "NewSecurePassword123!" },
      });

      fireEvent.click(screen.getByRole("button", { name: /Continue to Step 2/i }));

      await waitFor(() => {
        expect(authApi.setupAccount).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "valid-token-xyz",
            password: "NewSecurePassword123!",
          }),
          expect.anything()
        );
      });
    });

    it("clears old localStorage tokens to isolate invitation setup from previous admin session", () => {
      localStorage.setItem("access_token", "admin-stale-token");
      localStorage.setItem("refresh_token", "admin-stale-refresh");

      renderWithClient(<SetupAccountPage />);

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });
  });
});
