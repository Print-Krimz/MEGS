import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  provider: vi.fn(), signIn: vi.fn(), userFind: vi.fn(), userUpdate: vi.fn(),
  resetFind: vi.fn(), resetClaim: vi.fn(), otpFind: vi.fn(), otpRead: vi.fn(),
  otpUpdate: vi.fn(), otpClaim: vi.fn(), resetCreate: vi.fn(),
  invitationFind: vi.fn(), invitationClaim: vi.fn(), transaction: vi.fn(),
}));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: {
  admin: { updateUserById: mocks.provider }, signInWithPassword: mocks.signIn,
} } }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  user: { findUnique: mocks.userFind, updateMany: mocks.userUpdate },
  passwordResetSession: { findFirst: mocks.resetFind, updateMany: mocks.resetClaim, create: mocks.resetCreate },
  authOtp: { findFirst: mocks.otpFind, findUnique: mocks.otpRead, updateMany: mocks.otpClaim, update: mocks.otpUpdate },
  userInvitation: { findFirst: mocks.invitationFind, updateMany: mocks.invitationClaim },
  $transaction: mocks.transaction,
} }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/env.js", () => ({}));
vi.mock("../../src/utils/mailer.js", () => ({
  sendMail: vi.fn(), sendRegistrationOtpEmail: vi.fn(), sendPasswordResetOtpEmail: vi.fn(),
  redactAuthenticationSecrets: (value: string) => value,
}));
vi.mock("../../src/services/core/mfa.service.js", () => ({ getUserMfaFactors: vi.fn(), createMfaChallenge: vi.fn() }));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({ ensureApplicantProfile: vi.fn() }));

import { hashOtp } from "../../src/utils/otp.js";
import { resetUserPassword, setupAccount, verifyOtp } from "../../src/services/core/auth.service.js";

describe("atomic recovery, verification and invitation claims", () => {
  afterEach(() => vi.unstubAllEnvs());
  let consumed: boolean;
  let user: { id: string; email: string; isActive: boolean; accountStatus: string; mustChangePassword: boolean; role: string };
  let expiresAt: Date;
  let attempts: number;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DISABLE_OTP", "false");
    vi.stubEnv("OTP_SECRET", "synthetic-dedicated-otp-key-for-tests-only");
    consumed = false;
    attempts = 0;
    expiresAt = new Date(Date.now() + 60000);
    user = { id: "user-1", email: "test@example.invalid", role: "APPLICANT", isActive: true, accountStatus: "ACTIVE", mustChangePassword: true };
    mocks.userFind.mockImplementation(async () => ({ ...user }));
    mocks.userUpdate.mockImplementation(async ({ where, data }) => {
      if (!user.isActive || (typeof where.accountStatus === "string" ? user.accountStatus !== where.accountStatus : !where.accountStatus.in.includes(user.accountStatus))) return { count: 0 };
      Object.assign(user, data);
      return { count: 1 };
    });
    mocks.resetFind.mockImplementation(async () => consumed ? null : ({ id: "reset-1", userId: user.id, expiresAt }));
    mocks.resetClaim.mockImplementation(async ({ where }) => {
      if (consumed || expiresAt <= where.expiresAt.gt) return { count: 0 };
      consumed = true;
      return { count: 1 };
    });
    mocks.provider.mockResolvedValue({ error: null });
    mocks.signIn.mockResolvedValue({ data: { session: { access_token: "temporary-aal1-token" } } });
    mocks.otpFind.mockImplementation(async () => consumed ? null : ({ id: 1, attempts, maxAttempts: 5, expiresAt, otpHash: hashOtp("123456") }));
    mocks.otpRead.mockImplementation(async () => ({ attempts }));
    mocks.otpClaim.mockImplementation(async ({ where, data }) => {
      if (consumed || expiresAt <= where.expiresAt.gt || (where.attempts && attempts >= where.attempts.lt)) return { count: 0 };
      if (data.attempts) attempts += 1;
      if (data.isUsed) consumed = true;
      return { count: 1 };
    });
    mocks.otpUpdate.mockImplementation(async () => { consumed = true; return { attempts }; });
    mocks.invitationFind.mockImplementation(async () => consumed ? null : ({ id: "invitation-1", expiresAt, user: { ...user } }));
    mocks.invitationClaim.mockImplementation(async ({ where }) => {
      if (consumed || expiresAt <= where.expiresAt.gt || !user.isActive || !where.user.accountStatus.in.includes(user.accountStatus)) return { count: 0 };
      consumed = true;
      return { count: 1 };
    });
    mocks.transaction.mockImplementation(async (run) => run({ user: { updateMany: mocks.userUpdate, findUniqueOrThrow: async () => ({ ...user }) } }));
  });

  it("allows one simultaneous reset and denies replay before any second provider write", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => resetUserPassword("shared-reset-token", "new-password")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(user.mustChangePassword).toBe(false);
    expect(user.accountStatus).toBe("ACTIVE");
    await expect(resetUserPassword("shared-reset-token", "other-password")).rejects.toThrow("Invalid or expired");
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("claims before the provider call and leaves a failed/ambiguous call consumed", async () => {
    mocks.provider.mockImplementation(async () => {
      expect(consumed).toBe(true);
      throw new Error("ambiguous provider timeout");
    });
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow();
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("Invalid or expired");
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("keeps a session consumed when the local database fails after the provider succeeds", async () => {
    mocks.userUpdate.mockRejectedValue(new Error("synthetic database failure"));
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow();
    expect(consumed).toBe(true);
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("Invalid or expired");
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });

  it("returns a safe error on a reported provider failure and does not reopen the reset", async () => {
    mocks.provider.mockResolvedValue({ error: { message: "private provider connection details" } });
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("Please request a new reset code");
    expect(consumed).toBe(true);
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("rejects an expired session without contacting the provider", async () => {
    expiresAt = new Date(Date.now() - 1);
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("Invalid or expired");
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it.each(["DEACTIVATED", "PENDING", "INVITED", "PENDING_VERIFICATION"])("does not use recovery to activate %s accounts", async (status) => {
    user.accountStatus = status;
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("invalid or deactivated");
    expect(mocks.provider).not.toHaveBeenCalled();
    expect(consumed).toBe(false);
  });

  it("denies an inactive account even when its status is ACTIVE", async () => {
    user.isActive = false;
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("invalid or deactivated");
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("does not reactivate an account disabled during the external provider call", async () => {
    mocks.provider.mockImplementation(async () => { user.isActive = false; return { error: null }; });
    await expect(resetUserPassword("token", "new-password")).rejects.toThrow("invalid or deactivated");
    expect(user.isActive).toBe(false);
    expect(consumed).toBe(true);
  });

  it("issues only one recovery session from simultaneous correct OTP submissions", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => verifyOtp(user.email, "123456", "PASSWORD_RESET")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(mocks.resetCreate).toHaveBeenCalledTimes(1);
    expect(attempts).toBeLessThanOrEqual(5);
  });

  it("caps simultaneous incorrect OTP guesses at the stored attempt budget", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => verifyOtp(user.email, "111111", "PASSWORD_RESET")));
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(attempts).toBe(5);
    expect(mocks.resetCreate).not.toHaveBeenCalled();
  });

  it("preserves pending applicant email verification without issuing a reset token", async () => {
    user.accountStatus = "PENDING_VERIFICATION";
    await expect(verifyOtp(user.email, "123456", "REGISTRATION")).resolves.toMatchObject({ message: expect.stringContaining("verified successfully") });
    expect(user.accountStatus).toBe("ACTIVE");
    expect(mocks.resetCreate).not.toHaveBeenCalled();
  });

  it("activates one invitation and preserves the temporary MFA enrollment session", async () => {
    user.accountStatus = "INVITED";
    user.role = "TALENT_ACQUISITION";
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => setupAccount("invitation-token", "new-password")));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const success = results.find((result) => result.status === "fulfilled");
    expect(success && success.status === "fulfilled" && success.value).toMatchObject({ tempToken: "temporary-aal1-token" });
    expect(mocks.provider).toHaveBeenCalledTimes(1);
    expect(user.accountStatus).toBe("ACTIVE");
  });

  it("rejects a deactivated invitation without a provider mutation", async () => {
    user.accountStatus = "INVITED";
    user.isActive = false;
    await expect(setupAccount("token", "new-password")).rejects.toThrow("pending invitation");
    expect(mocks.provider).not.toHaveBeenCalled();
  });

  it("keeps a failed invitation consumed and directs the user to request a new one", async () => {
    user.accountStatus = "INVITED";
    mocks.provider.mockResolvedValue({ error: { message: "private provider details" } });
    await expect(setupAccount("token", "new-password")).rejects.toThrow("new invitation");
    expect(consumed).toBe(true);
    expect(user.accountStatus).toBe("INVITED");
    await expect(setupAccount("token", "new-password")).rejects.toThrow("Invalid or expired");
    expect(mocks.provider).toHaveBeenCalledTimes(1);
  });
});
