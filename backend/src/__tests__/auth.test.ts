import { describe, expect, it, vi, beforeEach } from "vitest";

const mockCreateUser = vi.fn();
const mockSignInWithPassword = vi.fn();
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
        updateUserById: (...args: any[]) => mockUpdateUserById(...args),
        signOut: (...args: any[]) => mockSignOut(...args),
      },
    },
  },
}));

const mockFindUniqueUser = vi.fn();
const mockCreateUserDb = vi.fn();
const mockUpdateUserDb = vi.fn();

const mockFindFirstAuthOtp = vi.fn();
const mockCreateAuthOtp = vi.fn();
const mockUpdateAuthOtp = vi.fn();
const mockUpdateManyAuthOtp = vi.fn();

const mockFindFirstResetSession = vi.fn();
const mockCreateResetSession = vi.fn();
const mockUpdateResetSession = vi.fn();
const mockUpdateManyResetSession = vi.fn();

vi.mock("../utils/prisma.js", () => ({
  default: {
    user: {
      findUnique: (...args: any[]) => mockFindUniqueUser(...args),
      create: (...args: any[]) => mockCreateUserDb(...args),
      update: (...args: any[]) => mockUpdateUserDb(...args),
    },
    authOtp: {
      findFirst: (...args: any[]) => mockFindFirstAuthOtp(...args),
      create: (...args: any[]) => mockCreateAuthOtp(...args),
      update: (...args: any[]) => mockUpdateAuthOtp(...args),
      updateMany: (...args: any[]) => mockUpdateManyAuthOtp(...args),
    },
    passwordResetSession: {
      findFirst: (...args: any[]) => mockFindFirstResetSession(...args),
      create: (...args: any[]) => mockCreateResetSession(...args),
      update: (...args: any[]) => mockUpdateResetSession(...args),
      updateMany: (...args: any[]) => mockUpdateManyResetSession(...args),
    },
    userInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback: any) => {
      if (typeof callback === "function") {
        return callback(prismaMock);
      }
      return Promise.all(callback);
    }),
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

import prismaMock from "../utils/prisma.js";

const mockSendRegistrationOtpEmail = vi.fn().mockResolvedValue({ success: true });
const mockSendPasswordResetOtpEmail = vi.fn().mockResolvedValue({ success: true });
const mockSendMail = vi.fn().mockResolvedValue({ success: true });

vi.mock("../utils/mailer.js", () => ({
  sendRegistrationOtpEmail: (...args: any[]) => mockSendRegistrationOtpEmail(...args),
  sendPasswordResetOtpEmail: (...args: any[]) => mockSendPasswordResetOtpEmail(...args),
  sendMail: (...args: any[]) => mockSendMail(...args),
  fromAddress: "test@example.com",
}));

import {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  requestPasswordReset,
  resetUserPassword,
  changeUserPassword,
  setupAccount,
  getInvitationDetails,
} from "../services/core/auth.service.js";
import { hashOtp, hashToken } from "../utils/otp.js";

describe("Core Auth Services (6-Digit OTP Flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerUser", () => {
    it("creates user in PENDING_VERIFICATION status and sends 6-digit OTP", async () => {
      mockFindUniqueUser.mockResolvedValueOnce(null);
      mockCreateUser.mockResolvedValueOnce({
        data: { user: { id: "user-uuid-1", email: "applicant@example.com" } },
        error: null,
      });
      mockCreateUserDb.mockResolvedValueOnce({
        id: "user-uuid-1",
        email: "applicant@example.com",
        role: "APPLICANT",
        accountStatus: "PENDING_VERIFICATION",
        mustChangePassword: false,
      });
      mockUpdateManyAuthOtp.mockResolvedValueOnce({ count: 0 });
      mockCreateAuthOtp.mockResolvedValueOnce({ id: 1 });

      const result = await registerUser("applicant@example.com", "Password123!");

      expect(mockCreateUserDb).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: "user-uuid-1",
          email: "applicant@example.com",
          role: "APPLICANT",
          accountStatus: "PENDING_VERIFICATION",
          mustChangePassword: false,
        }),
      });
      expect(mockCreateAuthOtp).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "applicant@example.com",
          purpose: "REGISTRATION",
          attempts: 0,
          maxAttempts: 5,
          isUsed: false,
        }),
      });
      expect(mockSendRegistrationOtpEmail).toHaveBeenCalledWith(
        "applicant@example.com",
        expect.stringMatching(/^\d{6}$/)
      );
      expect(result.accountStatus).toBe("PENDING_VERIFICATION");
    });

    it("rejects password shorter than 8 characters", async () => {
      await expect(registerUser("test@example.com", "short")).rejects.toThrow(
        "Password must be at least 8 characters"
      );
    });

    it("rejects existing active email with conflict error", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "existing-id",
        email: "exists@example.com",
        accountStatus: "ACTIVE",
      });
      await expect(registerUser("exists@example.com", "Password123!")).rejects.toThrow(
        "already exists"
      );
    });
  });

  describe("loginUser", () => {
    it("returns session for ACTIVE user", async () => {
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

      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-uuid-1",
        email: "applicant@example.com",
        role: "APPLICANT",
        isActive: true,
        accountStatus: "ACTIVE",
        mustChangePassword: false,
      });

      const result = await loginUser("applicant@example.com", "Password123!");

      expect(result.access_token).toBe("mock-access-token");
      expect(result.user.accountStatus).toBe("ACTIVE");
    });

    it("blocks login if account is in PENDING_VERIFICATION status", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: "mock-token" },
          user: { id: "unverified-id" },
        },
        error: null,
      });

      mockFindUniqueUser.mockResolvedValueOnce({
        id: "unverified-id",
        email: "unverified@example.com",
        role: "APPLICANT",
        isActive: true,
        accountStatus: "PENDING_VERIFICATION",
        mustChangePassword: false,
      });

      await expect(loginUser("unverified@example.com", "Password123!")).rejects.toThrow(
        "Please verify your email address with the 6-digit code"
      );
    });

    it("rejects login if account is in PENDING status with safe message", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          session: { access_token: "mock-token" },
          user: { id: "invited-user-id" },
        },
        error: null,
      });

      mockFindUniqueUser.mockResolvedValueOnce({
        id: "invited-user-id",
        email: "ta@example.com",
        role: "TALENT_ACQUISITION",
        isActive: true,
        accountStatus: "PENDING",
        mustChangePassword: false,
      });

      await expect(loginUser("ta@example.com", "TempPassword123!")).rejects.toThrow(
        "Your account setup is not yet complete. Please check your invitation email to finish setting up your account."
      );
    });
  });

  describe("verifyOtp", () => {
    it("activates account on valid REGISTRATION OTP", async () => {
      const validCode = "729401";
      const hashed = hashOtp(validCode);

      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 10,
        email: "applicant@example.com",
        otpHash: hashed,
        purpose: "REGISTRATION",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
      });
      mockUpdateAuthOtp.mockResolvedValue({ id: 10, attempts: 1 });
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-1",
        email: "applicant@example.com",
        accountStatus: "PENDING_VERIFICATION",
      });
      mockUpdateUserDb.mockResolvedValueOnce({
        id: "user-1",
        accountStatus: "ACTIVE",
      });

      const res = await verifyOtp("applicant@example.com", validCode, "REGISTRATION");

      expect(res.message).toContain("Email verified successfully");
      expect(mockUpdateUserDb).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { accountStatus: "ACTIVE" },
      });
    });

    it("rejects invalid code and increments attempt counter", async () => {
      const storedHashed = hashOtp("111111");

      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 10,
        email: "applicant@example.com",
        otpHash: storedHashed,
        purpose: "REGISTRATION",
        attempts: 1,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
      });
      mockUpdateAuthOtp.mockResolvedValueOnce({ id: 10, attempts: 2 });

      await expect(
        verifyOtp("applicant@example.com", "999999", "REGISTRATION")
      ).rejects.toThrow("Invalid verification code. 3 attempts remaining.");
    });

    it("rejects expired OTP code", async () => {
      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 10,
        email: "applicant@example.com",
        otpHash: hashOtp("123456"),
        purpose: "REGISTRATION",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() - 1000), // Expired
        isUsed: false,
      });
      mockUpdateAuthOtp.mockResolvedValueOnce({ id: 10, isUsed: true });

      await expect(
        verifyOtp("applicant@example.com", "123456", "REGISTRATION")
      ).rejects.toThrow("Verification code has expired");
    });

    it("creates PasswordResetSession when PASSWORD_RESET OTP is verified", async () => {
      const validCode = "654321";
      const hashed = hashOtp(validCode);

      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 20,
        email: "user@example.com",
        otpHash: hashed,
        purpose: "PASSWORD_RESET",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        isUsed: false,
      });
      mockUpdateAuthOtp.mockResolvedValue({ id: 20, attempts: 1 });
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
        isActive: true,
        accountStatus: "ACTIVE",
      });
      mockUpdateManyResetSession.mockResolvedValueOnce({ count: 0 });
      mockCreateResetSession.mockResolvedValueOnce({ id: "session-1" });

      const res = await verifyOtp("user@example.com", validCode, "PASSWORD_RESET");

      expect(res.resetToken).toBeDefined();
      expect(res.resetToken).toHaveLength(64);
      expect(mockCreateResetSession).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          email: "user@example.com",
          isUsed: false,
        }),
      });
    });
  });

  describe("resendOtp", () => {
    it("enforces 60-second cooldown between OTP requests", async () => {
      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 1,
        email: "cooldown@example.com",
        purpose: "REGISTRATION",
        createdAt: new Date(Date.now() - 20000), // Only 20s ago
      });

      await expect(
        resendOtp("cooldown@example.com", "REGISTRATION")
      ).rejects.toThrow(/Please wait \d+ seconds/);
    });

    it("invalidates old OTPs and dispatches new code after cooldown", async () => {
      mockFindFirstAuthOtp.mockResolvedValueOnce({
        id: 1,
        email: "valid@example.com",
        purpose: "REGISTRATION",
        createdAt: new Date(Date.now() - 65000), // 65s ago (past cooldown)
      });
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-1",
        email: "valid@example.com",
        accountStatus: "PENDING_VERIFICATION",
      });
      mockUpdateManyAuthOtp.mockResolvedValueOnce({ count: 1 });
      mockCreateAuthOtp.mockResolvedValueOnce({ id: 2 });

      const res = await resendOtp("valid@example.com", "REGISTRATION");

      expect(res.message).toContain("A new verification code has been sent");
      expect(mockUpdateManyAuthOtp).toHaveBeenCalledWith({
        where: { email: "valid@example.com", purpose: "REGISTRATION", isUsed: false },
        data: { isUsed: true },
      });
      expect(mockSendRegistrationOtpEmail).toHaveBeenCalledWith(
        "valid@example.com",
        expect.stringMatching(/^\d{6}$/)
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("returns generic message to prevent email enumeration", async () => {
      mockFindUniqueUser.mockResolvedValueOnce(null);

      const result = await requestPasswordReset("nonexistent@example.com");

      expect(result.message).toContain("If an account exists for this email");
      expect(mockCreateAuthOtp).not.toHaveBeenCalled();
    });

    it("generates 6-digit PASSWORD_RESET OTP and sends email when user exists", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
        isActive: true,
        accountStatus: "ACTIVE",
      });
      mockFindFirstAuthOtp.mockResolvedValueOnce(null); // No prior OTP
      mockUpdateManyAuthOtp.mockResolvedValueOnce({ count: 0 });
      mockCreateAuthOtp.mockResolvedValueOnce({ id: 1 });

      const result = await requestPasswordReset("user@example.com");

      expect(result.message).toContain("If an account exists for this email");
      expect(mockCreateAuthOtp).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "user@example.com",
          purpose: "PASSWORD_RESET",
        }),
      });
      expect(mockSendPasswordResetOtpEmail).toHaveBeenCalledWith(
        "user@example.com",
        expect.stringMatching(/^\d{6}$/)
      );
    });
  });

  describe("resetUserPassword", () => {
    it("updates password strictly using session bound userId and marks session used", async () => {
      const rawToken = "sample-raw-reset-token-64-character-length-hex-string-placeholder";
      const tokenHash = hashToken(rawToken);

      mockFindFirstResetSession.mockResolvedValueOnce({
        id: "session-uuid-1",
        userId: "target-user-id",
        email: "user@example.com",
        tokenHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        isUsed: false,
      });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdateUserDb.mockResolvedValueOnce({ id: "target-user-id" });
      mockUpdateResetSession.mockResolvedValueOnce({ id: "session-uuid-1", isUsed: true });

      const result = await resetUserPassword(rawToken, "NewSecurePassword123!");

      expect(mockUpdateUserById).toHaveBeenCalledWith("target-user-id", {
        password: "NewSecurePassword123!",
      });
      expect(mockUpdateUserDb).toHaveBeenCalledWith({
        where: { id: "target-user-id" },
        data: { mustChangePassword: false, accountStatus: "ACTIVE" },
      });
      expect(mockUpdateResetSession).toHaveBeenCalledWith({
        where: { id: "session-uuid-1" },
        data: { isUsed: true },
      });
      expect(result.message).toContain("Password has been reset successfully");
    });

    it("rejects invalid or expired reset tokens", async () => {
      mockFindFirstResetSession.mockResolvedValueOnce(null);

      await expect(
        resetUserPassword("invalid-token", "NewPassword123!")
      ).rejects.toThrow("Invalid or expired password reset session");
    });
  });

  describe("changeUserPassword", () => {
    it("verifies current password before updating to new password", async () => {
      mockFindUniqueUser.mockResolvedValueOnce({
        id: "user-123",
        email: "user@example.com",
      });
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { session: {} },
        error: null,
      });
      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdateUserDb.mockResolvedValueOnce({ id: "user-123", mustChangePassword: false });

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
  });

  describe("getInvitationDetails", () => {
    it("returns masked email and valid status for active unexpired token", async () => {
      const rawToken = "my-secure-invitation-token-12345";
      const tokenHash = hashToken(rawToken);

      (prismaMock.userInvitation.findFirst as any).mockResolvedValueOnce({
        id: "inv-1",
        userId: "ta-user-123",
        email: "dresden.recruiter@gmail.com",
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isUsed: false,
        user: {
          id: "ta-user-123",
          email: "dresden.recruiter@gmail.com",
          role: "TALENT_ACQUISITION",
          accountStatus: "PENDING",
        },
      });

      const details = await getInvitationDetails(rawToken);

      expect(details.valid).toBe(true);
      expect(details.maskedEmail).toBe("dr***************@gmail.com");
      expect(details.role).toBe("TALENT_ACQUISITION");
    });

    it("rejects expired or used invitation tokens", async () => {
      (prismaMock.userInvitation.findFirst as any).mockResolvedValueOnce(null);

      await expect(getInvitationDetails("expired-or-used-token")).rejects.toThrow(
        "Invalid, used, or expired invitation token"
      );
    });
  });

  describe("setupAccount", () => {
    it("activates a PENDING account and sets permanent password", async () => {
      const rawToken = "my-secure-invitation-token-54321";
      const tokenHash = hashToken(rawToken);

      (prismaMock.userInvitation.findFirst as any).mockResolvedValueOnce({
        id: "inv-1",
        userId: "invited-ta-123",
        email: "ta@megs.com",
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isUsed: false,
        user: {
          id: "invited-ta-123",
          email: "ta@megs.com",
          role: "TALENT_ACQUISITION",
          accountStatus: "PENDING",
        },
      });

      mockUpdateUserById.mockResolvedValueOnce({ error: null });
      mockUpdateUserDb.mockResolvedValueOnce({
        id: "invited-ta-123",
        email: "ta@megs.com",
        role: "TALENT_ACQUISITION",
        accountStatus: "ACTIVE",
      });
      (prismaMock.userInvitation.update as any).mockResolvedValueOnce({
        id: "inv-1",
        isUsed: true,
      });

      mockSignInWithPassword.mockResolvedValueOnce({
        data: { session: { access_token: "mock-session-token" } },
        error: null,
      });

      const result = await setupAccount(rawToken, "MyNewPermanentPassword123!");

      expect(mockUpdateUserById).toHaveBeenCalledWith("invited-ta-123", {
        password: "MyNewPermanentPassword123!",
        email_confirm: true,
      });
      expect(result.user.accountStatus).toBe("ACTIVE");
      expect(result.message).toContain("Account setup completed successfully");
    });

    it("rejects password shorter than 8 characters", async () => {
      await expect(setupAccount("valid-token", "short")).rejects.toThrow(
        "Password must be at least 8 characters long"
      );
    });
  });
});

