import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  otpFindFirst: vi.fn(),
  otpUpdateMany: vi.fn(),
  otpCreate: vi.fn(),
  otpFindUnique: vi.fn(),
  resetUpdateMany: vi.fn(),
  resetCreate: vi.fn(),
  resetFindFirst: vi.fn(),
  verifyOtpHash: vi.fn(),
  sendPasswordResetOtpEmail: vi.fn(),
}));

vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { admin: {} } } }));
vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique },
    authOtp: {
      findFirst: mocks.otpFindFirst,
      findUnique: mocks.otpFindUnique,
      updateMany: mocks.otpUpdateMany,
      create: mocks.otpCreate,
    },
    passwordResetSession: {
      updateMany: mocks.resetUpdateMany,
      create: mocks.resetCreate,
      findFirst: mocks.resetFindFirst,
    },
  },
}));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/mailer.js", () => ({
  sendMail: vi.fn(),
  sendRegistrationOtpEmail: vi.fn(),
  sendPasswordResetOtpEmail: mocks.sendPasswordResetOtpEmail,
}));
vi.mock("../../src/utils/otp.js", () => ({
  generateNumericOtp: () => "123456",
  hashOtp: (otp: string) => `hashed-${otp}`,
  verifyOtpHash: mocks.verifyOtpHash,
  generateSecureToken: () => "raw-reset-token",
  hashToken: (token: string) => `hash-${token}`,
}));
vi.mock("../../src/services/core/mfa.service.js", () => ({ getUserMfaFactors: vi.fn(), createMfaChallenge: vi.fn() }));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({ ensureApplicantProfile: vi.fn() }));

import {
  getResetSessionStatus,
  requestPasswordReset,
  resendOtp,
  verifyOtp,
} from "../../src/services/core/auth.service.js";

const NOW = new Date("2026-11-01T08:00:00.000Z");
const activeUser = { id: "user-1", email: "ta@example.invalid", isActive: true, accountStatus: "ACTIVE" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubEnv("DISABLE_RATE_LIMIT", "false");
  mocks.userFindUnique.mockResolvedValue(activeUser);
  mocks.otpFindFirst.mockResolvedValue(null);
  mocks.otpUpdateMany.mockResolvedValue({ count: 1 });
  mocks.otpCreate.mockResolvedValue({});
  mocks.resetUpdateMany.mockResolvedValue({ count: 0 });
  mocks.resetCreate.mockResolvedValue({});
  mocks.sendPasswordResetOtpEmail.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const deadlines = {
  expiresAt: "2026-11-01T08:10:00.000Z",
  resendAvailableAt: "2026-11-01T08:01:00.000Z",
};

describe("code deadlines returned to the client", () => {
  it("forgot password returns 10-minute expiry and 60-second resend deadlines, stored on the OTP row", async () => {
    const result = await requestPasswordReset("ta@example.invalid");

    expect(result).toMatchObject(deadlines);
    expect(mocks.otpCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdAt: NOW, expiresAt: new Date(deadlines.expiresAt) }),
    });
  });

  it("forgot password answers an unknown email with the same shape and deadlines", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const unknown = await requestPasswordReset("nobody@example.invalid");

    expect(Object.keys(unknown).sort()).toEqual(["expiresAt", "message", "resendAvailableAt"]);
    expect(unknown).toMatchObject(deadlines);
    expect(mocks.otpCreate).not.toHaveBeenCalled();
  });

  it("resend returns the new deadlines, and the same shape for an unknown reset account", async () => {
    const real = await resendOtp("ta@example.invalid", "PASSWORD_RESET");
    expect(real).toMatchObject(deadlines);

    mocks.userFindUnique.mockResolvedValue(null);
    const unknown = await resendOtp("nobody@example.invalid", "PASSWORD_RESET");
    expect(Object.keys(unknown).sort()).toEqual(Object.keys(real).sort());
    expect(unknown).toMatchObject(deadlines);
  });

  it("keeps the existing cooldown error text, which forgot password re-throws by pattern", async () => {
    mocks.otpFindFirst.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 30_000) });

    await expect(requestPasswordReset("ta@example.invalid")).rejects.toThrow(
      /^Please wait \d+ seconds before requesting another code\.$/
    );
  });
});

describe("reset session expiry", () => {
  it("verifyOtp for a password reset returns the 15-minute session deadline", async () => {
    mocks.otpFindFirst.mockResolvedValue({
      id: 1,
      attempts: 0,
      maxAttempts: 5,
      otpHash: "hashed-123456",
      expiresAt: new Date(NOW.getTime() + 60_000),
    });
    mocks.otpUpdateMany.mockResolvedValue({ count: 1 });
    mocks.verifyOtpHash.mockReturnValue(true);

    const result = await verifyOtp("ta@example.invalid", "123456", "PASSWORD_RESET");

    expect(result.resetTokenExpiresAt).toBe("2026-11-01T08:15:00.000Z");
    expect(mocks.resetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ expiresAt: new Date("2026-11-01T08:15:00.000Z") }),
    });
  });

  it("getResetSessionStatus returns expiresAt for a live token", async () => {
    mocks.resetFindFirst.mockResolvedValue({ expiresAt: new Date(NOW.getTime() + 5 * 60_000) });

    await expect(getResetSessionStatus("raw-reset-token")).resolves.toEqual({
      expiresAt: "2026-11-01T08:05:00.000Z",
    });
    expect(mocks.resetFindFirst).toHaveBeenCalledWith({ where: { tokenHash: "hash-raw-reset-token", isUsed: false } });
  });

  it("getResetSessionStatus gives one error for unknown, used and expired tokens", async () => {
    const message = "Invalid or expired password reset session";

    mocks.resetFindFirst.mockResolvedValue(null);
    await expect(getResetSessionStatus("unknown")).rejects.toThrow(message);

    mocks.resetFindFirst.mockResolvedValue({ expiresAt: new Date(NOW.getTime() - 1) });
    await expect(getResetSessionStatus("expired")).rejects.toThrow(message);
  });
});
