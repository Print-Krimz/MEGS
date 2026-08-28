import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MfaChallengeModal } from "../MfaChallengeModal";

import { MfaSetupModal } from "../MfaSetupModal";
import { authApi } from "../../../lib/api/auth.api";

vi.mock("../../../lib/api/auth.api", () => ({
  authApi: {
    verifyMfaLogin: vi.fn(),
    verifyMfaRecovery: vi.fn(),
    enrollMfa: vi.fn(),
    verifyMfaEnrollment: vi.fn(),
  },
}));

vi.mock("../../../lib/feedback", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  formatErrorMessage: (err: any) => err?.message || "Error occurred",
}));

describe("MFA Modal Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MfaChallengeModal", () => {
    it("renders TOTP challenge form and submits 6-digit code", async () => {
      const onSuccess = vi.fn();
      (authApi.verifyMfaLogin as any).mockResolvedValue({
        access_token: "active-token",
        user: { id: "u-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
      });

      render(
        <MfaChallengeModal
          open={true}
          onClose={vi.fn()}
          tempToken="temp-token-123"
          factorId="factor-123"
          challengeId="challenge-123"
          email="admin@megs.ph"
          onSuccess={onSuccess}
        />
      );

      expect(screen.getByText(/Two-Factor Authentication/i)).toBeDefined();
      expect(screen.getByText(/Security verification required for admin@megs.ph/i)).toBeDefined();

      const codeInput = screen.getByLabelText(/Authenticator Code/i);
      fireEvent.change(codeInput, { target: { value: "123456" } });

      fireEvent.click(screen.getByRole("button", { name: /Verify Code/i }));

      await waitFor(() => {
        expect(authApi.verifyMfaLogin).toHaveBeenCalledWith({
          token: "temp-token-123",
          factorId: "factor-123",
          challengeId: "challenge-123",
          code: "123456",
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it("allows switching to recovery code mode and submitting emergency code", async () => {
      const onSuccess = vi.fn();
      (authApi.verifyMfaRecovery as any).mockResolvedValue({
        access_token: "active-token",
        user: { id: "u-1", email: "admin@megs.ph", role: "ADMINISTRATOR" },
      });

      render(
        <MfaChallengeModal
          open={true}
          onClose={vi.fn()}
          tempToken="temp-token-123"
          factorId="factor-123"
          challengeId="challenge-123"
          email="admin@megs.ph"
          onSuccess={onSuccess}
        />
      );

      // Switch to recovery code
      const toggleBtn = screen.getByRole("button", { name: /Lost device\? Use emergency backup code/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByLabelText(/Emergency Recovery Code/i)).toBeDefined();

      const recoveryInput = screen.getByLabelText(/Emergency Recovery Code/i);
      fireEvent.change(recoveryInput, { target: { value: "A1B2-C3D4" } });

      fireEvent.click(screen.getByRole("button", { name: /Verify Recovery Code/i }));

      await waitFor(() => {
        expect(authApi.verifyMfaRecovery).toHaveBeenCalledWith({
          token: "temp-token-123",
          recoveryCode: "A1B2-C3D4",
        });
        expect(onSuccess).toHaveBeenCalled();
      });
    });
  });

  describe("MfaSetupModal", () => {
    it("loads QR code and secret on open, verifies code and shows recovery backup codes", async () => {
      const onSuccess = vi.fn();
      (authApi.enrollMfa as any).mockResolvedValue({
        factorId: "factor-abc",
        type: "totp",
        qrCode: "data:image/svg+xml;base64,mockqr",
        secret: "TESTSECRETKEY1234",
        uri: "otpauth://totp/MEGS",
      });

      (authApi.verifyMfaEnrollment as any).mockResolvedValue({
        message: "MFA Verified",
        recoveryCodes: [
          "1111-2222",
          "3333-4444",
          "5555-6666",
          "7777-8888",
          "AAAA-BBBB",
          "CCCC-DDDD",
          "EEEE-FFFF",
          "GGGG-HHHH",
        ],
        access_token: "enrolled-token",
        user: { id: "u-1", email: "ta@megs.ph", role: "TALENT_ACQUISITION" },
      });

      render(
        <MfaSetupModal
          open={true}
          onClose={vi.fn()}
          tempToken="enroll-token-123"
          email="ta@megs.ph"
          onSuccess={onSuccess}
        />
      );

      await waitFor(() => {
        expect(authApi.enrollMfa).toHaveBeenCalledWith("enroll-token-123");
        expect(screen.getByText("TESTSECRETKEY1234")).toBeDefined();
      });

      // Enter 6-digit TOTP code
      const codeInput = screen.getByLabelText(/Enter 6-Digit Code from App/i);
      fireEvent.change(codeInput, { target: { value: "654321" } });


      fireEvent.click(screen.getByRole("button", { name: /Verify & Enable MFA/i }));

      await waitFor(() => {
        expect(authApi.verifyMfaEnrollment).toHaveBeenCalledWith({
          token: "enroll-token-123",
          factorId: "factor-abc",
          code: "654321",
        });
        expect(screen.getByText(/Save Your Emergency Backup Codes/i)).toBeDefined();
        expect(screen.getByText("1111-2222")).toBeDefined();
        expect(screen.getByText("GGGG-HHHH")).toBeDefined();
      });

      // Check acknowledgment checkbox and continue
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const finishBtn = screen.getByRole("button", { name: /Continue to Workspace/i });
      fireEvent.click(finishBtn);

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          access_token: "enrolled-token",
        })
      );
    });
  });
});
