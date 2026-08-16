import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockGenerateLink = vi.fn();
const mockGetUser = vi.fn();
const mockUpdateUserById = vi.fn();
const mockSignOut = vi.fn();

vi.mock("../utils/supabase.js", () => ({
  default: {
    auth: {
      signInWithPassword: (...args: any[]) => mockSignInWithPassword(...args),
      getUser: (...args: any[]) => mockGetUser(...args),
      admin: {
        createUser: (...args: any[]) => mockCreateUser(...args),
        generateLink: (...args: any[]) => mockGenerateLink(...args),
        updateUserById: (...args: any[]) => mockUpdateUserById(...args),
        signOut: (...args: any[]) => mockSignOut(...args),
      },
    },
  },
}));

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../utils/prisma.js", () => ({
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
      create: (...args: any[]) => mockCreate(...args),
      update: (...args: any[]) => mockUpdate(...args),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

vi.mock("../utils/mailer.js", () => ({
  sendMail: vi.fn().mockResolvedValue({ success: true, messageId: "mock-id" }),
  fromAddress: "test@example.com",
}));

import {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetUserPassword,
  changeUserPassword,
  setupAccount,
} from "../services/core/auth.service.js";

describe("Core Auth Services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerUser", () => {
    it("assigns APPLICANT role automatically and creates user", async () => {
      mockFindUnique.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "user-uuid-1", email: "applicant@example.com" } },
        error: null,
      });
      mockCreate.mockResolvedValueOnce({
        id: "user-uuid-1",
        email: "applicant@example.com",
        role: "APPLICANT",
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      });

      const result = await registerUser("applicant@example.com", "Password123!");

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "user-uuid-1",
          email: "applicant@example.com",
          role: "APPLICANT",
          accountStatus: "ACTIVE",
          mustChangePassword: false,
        }),
      });
      expect(result.role).toBe("APPLICANT");
    });

    it("rejects password shorter than 8 characters", async () => {
      await expect(registerUser("test@example.com", "short")).rejects.toThrow(
        "Password must be at least 8 characters"
      );
    });

    it("rejects existing email with error", async () => {
      mockFindUnique.mockResolvedValueOnce({ id: "existing-id", email: "exists@example.com" });
      await expect(registerUser("exists@example.com", "Password123!")).rejects.toThrow(
        "already exists"
      );
    });
  });

  describe("loginUser", () => {
    it("returns user role, mustChangePassword, and accountStatus from database", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          session: {
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_in: 3600,
          },
          user: { id: "user-uuid-1", email: "applicant@example.com" },
        },
        error: null,
      });

      mockFindUnique.mockResolvedValueOnce({
        id: "user-uuid-1",
        email: "applicant@example.com",
        role: "APPLICANT",
        isActive: true,
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      });

      const result = await loginUser("applicant@example.com", "Password123!");

      expect(result.access_token).toBe("mock-access-token");
      expect(result.user.role).toBe("APPLICANT");
      expect(result.user.accountStatus).toBe("ACTIVE");
      expect(result.user.mustChangePassword).toBe(false);
    });

    it("rejects login if account is in INVITED status", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: "mock-token" },
          user: { id: "invited-user-id" },
        },
        error: null,
      });

      mockFindUnique.mockResolvedValueOnce({
        id: "invited-user-id",
        email: "ta@example.com",
        role: "TALENT_ACQUISITION",
        isActive: true,
        accountStatus: "INVITED",
        mustChangePassword: true,
      });

      await expect(loginUser("ta@example.com", "TempPassword123!")).rejects.toThrow(
        "Account setup has not been completed"
      );
    });

    it("rejects deactivated accounts", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: "mock-token" },
          user: { id: "deactivated-user-id" },
        },
        error: null,
      });

      mockFindUnique.mockResolvedValueOnce({
        id: "deactivated-user-id",
        email: "deactivated@example.com",
        role: "APPLICANT",
        isActive: false,
        accountStatus: "DEACTIVATED",
      });

      await expect(loginUser("deactivated@example.com", "Password123!")).rejects.toThrow(
        "Account has been deactivated"
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("returns generic message regardless of whether email exists (prevents email enumeration)", async () => {
      mockFindUnique.mockResolvedValueOnce(null);

      const result = await requestPasswordReset("nonexistent@example.com");

      expect(result.message).toBe(
        "If an account exists for this email, a password reset link has been sent."
      );
      expect(mockGenerateLink).not.toHaveBeenCalled();
    });

    it("generates recovery link and sends email when user exists", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
        isActive: true,
      });

      mockGenerateLink.mockResolvedValueOnce({
        data: {
          properties: {
            action_link: "https://auth.example.com/verify?token=recovery-token-xyz",
          },
        },
        error: null,
      });

      const result = await requestPasswordReset("user@example.com");

      expect(result.message).toContain("If an account exists for this email");
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: "recovery",
        email: "user@example.com",
      });
    });
  });

  describe("resetUserPassword", () => {
    it("updates password and clears mustChangePassword", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
        error: null,
      });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdate.mockResolvedValueOnce({ id: "user-123", mustChangePassword: false });

      const result = await resetUserPassword("valid-reset-token", "NewSecurePassword123!");

      expect(mockUpdateUserById).toHaveBeenCalledWith("user-123", {
        password: "NewSecurePassword123!",
      });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { mustChangePassword: false, accountStatus: "ACTIVE" },
      });
      expect(result.message).toBe("Password has been reset successfully");
    });
  });

  describe("changeUserPassword", () => {
    it("verifies current password before updating to new password", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { session: {} },
        error: null,
      });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdate.mockResolvedValueOnce({ id: "user-123", mustChangePassword: false });

      const result = await changeUserPassword("user-123", "OldPassword123!", "NewPassword123!");

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "OldPassword123!",
      });
      expect(mockUpdateUserById).toHaveBeenCalledWith("user-123", {
        password: "NewPassword123!",
      });
      expect(result.message).toBe("Password changed successfully");
    });

    it("rejects password change if current password is wrong", async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { session: null },
        error: { message: "Invalid login credentials" },
      });

      await expect(
        changeUserPassword("user-123", "WrongPassword!", "NewPassword123!")
      ).rejects.toThrow("Current password is incorrect");
    });
  });

  describe("setupAccount", () => {
    it("activates an INVITED account and sets permanent password", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: "invited-ta-123" } },
        error: null,
      });
      mockFindUnique.mockResolvedValueOnce({
        id: "invited-ta-123",
        email: "ta@megs.com",
        accountStatus: "INVITED",
      });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdate.mockResolvedValueOnce({
        id: "invited-ta-123",
        email: "ta@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
      });

      const result = await setupAccount("valid-invite-token", "MyNewPermanentPassword123!");

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "invited-ta-123" },
        data: { accountStatus: "ACTIVE", mustChangePassword: false },
        select: expect.any(Object),
      });
      expect(result.user.accountStatus).toBe("ACTIVE");
    });
  });
});
