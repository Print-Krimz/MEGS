import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  findUnique: vi.fn(),
  getUserMfaFactors: vi.fn(),
  createMfaChallenge: vi.fn(),
}));

vi.mock("../../src/utils/supabase.js", () => ({
  default: { auth: { signInWithPassword: mocks.signInWithPassword } },
}));
vi.mock("../../src/utils/prisma.js", () => ({
  default: { user: { findUnique: mocks.findUnique } },
}));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/mailer.js", () => ({
  sendMail: vi.fn(),
  sendRegistrationOtpEmail: vi.fn(),
  sendPasswordResetOtpEmail: vi.fn(),
  redactAuthenticationSecrets: (value: string) => value,
}));
vi.mock("../../src/utils/otp.js", () => ({
  generateNumericOtp: vi.fn(),
  hashOtp: vi.fn(),
  verifyOtpHash: vi.fn(),
  generateSecureToken: vi.fn(),
  hashToken: vi.fn(),
}));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({
  ensureApplicantProfile: vi.fn(),
}));
vi.mock("../../src/services/core/mfa.service.js", () => ({
  getUserMfaFactors: mocks.getUserMfaFactors,
  createMfaChallenge: mocks.createMfaChallenge,
}));

import { loginUser } from "../../src/services/core/auth.service.js";

const baseUser = {
  id: "user-123",
  email: "user@example.com",
  role: "APPLICANT",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
};

describe("login compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: "aal1-token", refresh_token: "refresh", expires_in: 3600 },
        user: { id: "user-123" },
      },
      error: null,
    });
    mocks.findUnique.mockResolvedValue(baseUser);
  });

  it("preserves valid applicant login", async () => {
    const result = await loginUser("user@example.com", "password");
    expect(result).toMatchObject({
      access_token: "aal1-token",
      user: {
        id: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
        accountStatus: baseUser.accountStatus,
        mustChangePassword: baseUser.mustChangePassword,
      },
    });
  });

  it("returns a challenge instead of an ordinary staff session", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, role: "ADMINISTRATOR" });
    mocks.getUserMfaFactors.mockResolvedValue({
      isEnrolled: true,
      verifiedFactor: { id: "factor-1" },
    });
    mocks.createMfaChallenge.mockResolvedValue({ challengeId: "challenge-1" });
    const result = await loginUser("user@example.com", "password");
    expect(result).toMatchObject({
      mfaRequired: true,
      tempToken: "aal1-token",
      factorId: "factor-1",
      challengeId: "challenge-1",
    });
    expect(result).not.toHaveProperty("access_token");
  });

  it("preserves first-time staff MFA enrollment", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, role: "TALENT_ACQUISITION" });
    mocks.getUserMfaFactors.mockResolvedValue({ isEnrolled: false });
    const result = await loginUser("user@example.com", "password");
    expect(result).toMatchObject({ mfaSetupRequired: true, tempToken: "aal1-token" });
  });

  it("continues to reject pending verification at login", async () => {
    mocks.findUnique.mockResolvedValue({ ...baseUser, accountStatus: "PENDING_VERIFICATION" });
    await expect(loginUser("user@example.com", "password")).rejects.toThrow("verify your email");
  });
});
