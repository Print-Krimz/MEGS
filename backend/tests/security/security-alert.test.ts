import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.OTP_SECRET = "synthetic-security-alert-test-secret-0123456789";
  return {
    userFindUnique: vi.fn(),
    userFindFirst: vi.fn(),
    userUpdate: vi.fn(),
    auditFindFirst: vi.fn(),
    auditCreate: vi.fn(),
    authOtpFindFirst: vi.fn(),
    authOtpFindUnique: vi.fn(),
    authOtpCreate: vi.fn(),
    authOtpUpdate: vi.fn(),
    authOtpUpdateMany: vi.fn(),
    mfaRecoveryDeleteMany: vi.fn(),
    sendMail: vi.fn(),
    sendSms: vi.fn(),
    signInWithPassword: vi.fn(),
    updateUserById: vi.fn(),
    listFactors: vi.fn(),
    deleteFactor: vi.fn(),
    controls: {
      mfaDisabled: false,
      otpDisabled: false,
      rateLimitDisabled: false,
      captchaDisabled: false,
      earlyAssignmentEndAllowed: false,
    },
  };
});

vi.mock("../../src/utils/prisma.js", () => ({
  default: {
    user: { findUnique: mocks.userFindUnique, findFirst: mocks.userFindFirst, update: mocks.userUpdate },
    auditLog: { findFirst: mocks.auditFindFirst, create: mocks.auditCreate },
    authOtp: {
      findFirst: mocks.authOtpFindFirst,
      findUnique: mocks.authOtpFindUnique,
      create: mocks.authOtpCreate,
      update: mocks.authOtpUpdate,
      updateMany: mocks.authOtpUpdateMany,
    },
    userMfaRecoveryCode: { deleteMany: mocks.mfaRecoveryDeleteMany },
  },
}));
vi.mock("../../src/utils/mailer.js", () => ({
  sendMail: mocks.sendMail,
  renderBrandedEmail: () => "<html/>",
  getAppBaseUrl: () => "https://megsinc.com",
  escapeHtml: (s: string) => s,
  sendRegistrationOtpEmail: vi.fn(),
  sendPasswordResetOtpEmail: vi.fn(),
}));
vi.mock("../../src/utils/sms.js", async (orig) => ({
  ...(await orig<any>()),
  sendSmsViaTextBee: mocks.sendSms,
}));
vi.mock("../../src/utils/supabase.js", () => ({
  default: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      admin: {
        updateUserById: mocks.updateUserById,
        mfa: { listFactors: mocks.listFactors, deleteFactor: mocks.deleteFactor },
      },
    },
  },
}));
vi.mock("../../src/security/security-controls.js", () => ({
  getSecurityControls: () => mocks.controls,
}));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({
  ensureApplicantProfile: vi.fn(),
}));
vi.mock("../../src/security/shared-store.js", () => ({
  PostgresRateLimitStore: class {
    localKeys = false;
    init() {}
    async increment() {
      return { totalHits: 1, resetTime: new Date() };
    }
    async decrement() {}
    async resetKey() {}
  },
  connectSharedStore: vi.fn(),
  cleanupSecurityState: vi.fn(),
}));

import { notifyClaimProbe, notifySecurityEvent } from "../../src/services/core/security-alert.service.js";
import { changeUserPassword, requestPasswordChangeCode } from "../../src/services/core/auth.service.js";
import { resetUserMfa } from "../../src/services/core/mfa.service.js";
import { rateLimitHandler } from "../../src/middleware/rate-limiter.middleware.js";
import { hashOtp } from "../../src/utils/otp.js";
import { maskEmail } from "../../src/utils/mask.js";

type Row = Record<string, any>;

const USER_REAL: Row = {
  id: "user-real",
  email: "staff@example.com",
  phoneNumber: null,
  role: "TALENT_ACQUISITION",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
  applicantProfile: null,
};
const USER_PHONE: Row = {
  id: "user-phone",
  email: "639171234567@applicant.megs.local",
  phoneNumber: "+639171234567",
  role: "APPLICANT",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
  applicantProfile: null,
};
const USER_WALK_IN: Row = {
  id: "user-walkin",
  email: "639171234567@megs.internal",
  phoneNumber: "+639171234567",
  role: "APPLICANT",
  isActive: true,
  accountStatus: "WALK_IN",
  mustChangePassword: false,
  applicantProfile: null,
};
const USER_TARGET: Row = {
  id: "target-1",
  email: "target@example.com",
  phoneNumber: null,
  role: "APPLICANT",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
  applicantProfile: null,
};
const USER_ADMIN: Row = {
  id: "admin-1",
  email: "admin@megs.ph",
  phoneNumber: null,
  role: "ADMINISTRATOR",
  isActive: true,
  accountStatus: "ACTIVE",
  mustChangePassword: false,
  applicantProfile: null,
};

const matches = (user: Row, where: Row) =>
  Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === "object" && Array.isArray((cond as Row).in)) {
      return (cond as Row).in.includes(user[key]);
    }
    return user[key] === cond;
  });

/** Answers user lookups from a small in-memory directory. */
const useUsers = (...users: Row[]) => {
  const find = async ({ where }: { where: Row }) => users.find((user) => matches(user, where)) ?? null;
  mocks.userFindUnique.mockImplementation(find);
  mocks.userFindFirst.mockImplementation(find);
};

const otpRow = (plainCode: string, overrides: Row = {}) => ({
  id: 9,
  email: "staff@example.com",
  purpose: "PASSWORD_CHANGE",
  otpHash: hashOtp(plainCode),
  attempts: 0,
  maxAttempts: 5,
  expiresAt: new Date(Date.now() + 10 * 60_000),
  isUsed: false,
  ...overrides,
});

const auditDetails = (call: any[]) => JSON.parse(call[0].data.details);

const makeRes = () => {
  const res: any = {};
  res.getHeader = vi.fn(() => undefined);
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

// Fire-and-forget alerts run after the awaited call returns; a macrotask tick drains them.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const originalSmsFlag = process.env.SMS_NOTIFICATIONS_ENABLED;

describe("security alerts and change-password code", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SMS_NOTIFICATIONS_ENABLED = "true";
    mocks.controls.otpDisabled = false;
    mocks.controls.rateLimitDisabled = false;
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userUpdate.mockResolvedValue({});
    mocks.auditFindFirst.mockResolvedValue(null);
    mocks.auditCreate.mockResolvedValue({ id: 1 });
    mocks.authOtpFindFirst.mockResolvedValue(null);
    mocks.authOtpFindUnique.mockResolvedValue(null);
    mocks.authOtpCreate.mockResolvedValue({ id: 1 });
    mocks.authOtpUpdate.mockResolvedValue({});
    mocks.authOtpUpdateMany.mockResolvedValue({ count: 1 });
    mocks.mfaRecoveryDeleteMany.mockResolvedValue({ count: 0 });
    mocks.sendMail.mockResolvedValue({ success: true });
    mocks.sendSms.mockResolvedValue({ success: true, smsBatchId: "batch-1" });
    mocks.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.listFactors.mockResolvedValue({ data: { factors: [] }, error: null });
    mocks.deleteFactor.mockResolvedValue({ error: null });
  });

  afterEach(async () => {
    await flush();
    if (originalSmsFlag === undefined) delete process.env.SMS_NOTIFICATIONS_ENABLED;
    else process.env.SMS_NOTIFICATIONS_ENABLED = originalSmsFlag;
  });

  describe("notifySecurityEvent", () => {
    it("emails the stored address of a real-email account and records the alert by email", async () => {
      useUsers(USER_REAL);

      await notifySecurityEvent({ identifier: "Staff@Example.com " }, "SIGN_IN_LIMITED", { ip: "203.0.113.9" });

      expect(mocks.sendMail).toHaveBeenCalledTimes(1);
      expect(mocks.sendMail.mock.calls[0][0]).toBe("staff@example.com");
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
      expect(mocks.auditCreate.mock.calls[0][0].data).toMatchObject({ userId: "user-real", action: "SECURITY_ALERT_SENT" });
      expect(auditDetails(mocks.auditCreate.mock.calls[0])).toMatchObject({ event: "SIGN_IN_LIMITED", channel: "email" });
    });

    it("texts the stored phone of a phone-only account within 160 characters and without a link", async () => {
      useUsers(USER_PHONE);

      await notifySecurityEvent({ identifier: "09171234567" }, "SIGN_IN_LIMITED", { ip: "203.0.113.9" });

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).toHaveBeenCalledTimes(1);
      const [phone, text] = mocks.sendSms.mock.calls[0];
      expect(phone).toBe("+639171234567");
      expect(text.startsWith("MEGS: ")).toBe(true);
      expect(text.length).toBeLessThanOrEqual(160);
      expect(text).not.toContain("http");
      expect(auditDetails(mocks.auditCreate.mock.calls[0])).toMatchObject({ event: "SIGN_IN_LIMITED", channel: "sms" });
    });

    it("sends nothing to a phone-only account when SMS notifications are off", async () => {
      process.env.SMS_NOTIFICATIONS_ENABLED = "false";
      useUsers(USER_PHONE);

      await notifySecurityEvent({ userId: "user-phone" }, "SIGN_IN_LIMITED");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("does nothing for a registration still waiting for verification", async () => {
      useUsers({ ...USER_REAL, accountStatus: "PENDING_VERIFICATION" });

      await notifySecurityEvent({ userId: "user-real" }, "CODE_LOCKOUT");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("does nothing for an unknown identifier", async () => {
      useUsers(USER_REAL);

      await notifySecurityEvent({ identifier: "nobody@example.com" }, "SIGN_IN_LIMITED");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("does not send a second suspicious-event alert while one was sent in the last hour", async () => {
      useUsers(USER_REAL);
      mocks.auditFindFirst.mockResolvedValue({ id: 1 });

      await notifySecurityEvent({ identifier: "staff@example.com" }, "SIGN_IN_LIMITED");

      expect(mocks.auditFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: "user-real",
            action: "SECURITY_ALERT_SENT",
            details: { contains: '"event":"SIGN_IN_LIMITED"' },
          }),
        })
      );
      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("always alerts on a credential change, even when a recent alert row exists", async () => {
      useUsers(USER_REAL);
      mocks.auditFindFirst.mockResolvedValue({ id: 1 });

      await notifySecurityEvent({ userId: "user-real" }, "PASSWORD_CHANGED");

      expect(mocks.auditFindFirst).not.toHaveBeenCalled();
      expect(mocks.sendMail).toHaveBeenCalledTimes(1);
      expect(mocks.sendMail.mock.calls[0][0]).toBe("staff@example.com");
      expect(mocks.sendMail.mock.calls[0][1]).toBe("Your password was changed");
      expect(auditDetails(mocks.auditCreate.mock.calls[0])).toMatchObject({ event: "PASSWORD_CHANGED", channel: "email" });
    });
  });

  describe("resetUserMfa", () => {
    it("alerts the target's stored email and never the administrator's", async () => {
      useUsers(USER_TARGET, USER_ADMIN);
      mocks.listFactors.mockResolvedValue({ data: { factors: [{ id: "factor-1" }] }, error: null });

      await resetUserMfa("target-1", "admin-1");

      await vi.waitFor(() => {
        expect(mocks.auditCreate.mock.calls.some(([arg]: any[]) => arg.data.action === "SECURITY_ALERT_SENT")).toBe(true);
      });
      const recipients = mocks.sendMail.mock.calls.map((call) => call[0]);
      expect(recipients).toEqual(["target@example.com"]);
      expect(recipients).not.toContain("admin@megs.ph");
      expect(mocks.sendSms).not.toHaveBeenCalled();
      const alert = mocks.auditCreate.mock.calls.find(([arg]: any[]) => arg.data.action === "SECURITY_ALERT_SENT")!;
      expect(alert[0].data.userId).toBe("target-1");
    });
  });

  describe("notifyClaimProbe", () => {
    it("sends nothing when no walk-in account matches the phone", async () => {
      mocks.userFindFirst.mockResolvedValue(null);

      await notifyClaimProbe("09171234567", "203.0.113.9");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("sends nothing when the matching account is already active", async () => {
      mocks.userFindFirst.mockResolvedValue({ ...USER_WALK_IN, accountStatus: "ACTIVE" });

      await notifyClaimProbe("09171234567", "203.0.113.9");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });

    it("texts a walk-in account when someone probes its number", async () => {
      useUsers(USER_WALK_IN);

      await notifyClaimProbe("09171234567", "203.0.113.9");

      expect(mocks.sendSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendSms.mock.calls[0][0]).toBe("+639171234567");
      expect(mocks.sendSms.mock.calls[0][1]).toContain("claim your account");
    });
  });

  describe("rateLimitHandler", () => {
    it("answers a known and an unknown identifier with the same 429 response", async () => {
      useUsers(USER_REAL);
      const onLimit = (req: any) => {
        void notifySecurityEvent({ identifier: req.body.email }, "SIGN_IN_LIMITED", { ip: req.ip });
      };
      const handler = rateLimitHandler("Too many authentication attempts. Please try again after 15 minutes.", 900, onLimit);
      const known = makeRes();
      const unknown = makeRes();

      handler({ ip: "203.0.113.9", body: { email: "staff@example.com" } } as any, known);
      handler({ ip: "203.0.113.9", body: { email: "nobody@example.com" } } as any, unknown);
      await flush();

      expect(known.status.mock.calls).toEqual([[429]]);
      expect(known.status.mock.calls).toEqual(unknown.status.mock.calls);
      expect(known.json.mock.calls).toEqual(unknown.json.mock.calls);
      expect(known.json.mock.calls[0][0]).toEqual({
        success: false,
        message: "Too many authentication attempts. Please try again after 15 minutes.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: 900,
      });
      expect(mocks.sendMail).toHaveBeenCalledTimes(1);
      expect(mocks.sendMail.mock.calls[0][0]).toBe("staff@example.com");
    });
  });

  describe("changeUserPassword", () => {
    it("rejects a correct current password when no change code was issued, and does not update the password", async () => {
      useUsers(USER_REAL);

      await expect(
        changeUserPassword("user-real", "CurrentPass123!", "BrandNewPass456!", "123456")
      ).rejects.toThrow(/Invalid or expired verification code/);

      expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(mocks.updateUserById).not.toHaveBeenCalled();
    });

    it("rejects a wrong code and does not update the password", async () => {
      useUsers(USER_REAL);
      mocks.authOtpFindFirst.mockResolvedValue(otpRow("654321"));
      mocks.authOtpFindUnique.mockResolvedValue({ attempts: 1 });

      await expect(
        changeUserPassword("user-real", "CurrentPass123!", "BrandNewPass456!", "123456")
      ).rejects.toThrow("Invalid verification code. 4 attempts remaining.");

      expect(mocks.updateUserById).not.toHaveBeenCalled();
    });

    it("accepts the code that requestPasswordChangeCode emailed and then updates the password", async () => {
      useUsers(USER_REAL);

      await requestPasswordChangeCode("user-real", "CurrentPass123!");
      const emailedText = mocks.sendMail.mock.calls[0][2] as string;
      const code = emailedText.match(/code is (\d{6})/)![1];
      const stored = mocks.authOtpCreate.mock.calls[0][0].data;
      mocks.authOtpFindFirst.mockResolvedValue({ id: 9, ...stored });

      await changeUserPassword("user-real", "CurrentPass123!", "BrandNewPass456!", code);

      expect(mocks.updateUserById).toHaveBeenCalledWith("user-real", { password: "BrandNewPass456!" });
    });
  });

  describe("requestPasswordChangeCode", () => {
    it("emails the code to the stored address of a real-email account and nowhere else", async () => {
      useUsers(USER_REAL);

      const result = await requestPasswordChangeCode("user-real", "CurrentPass123!");

      expect(mocks.sendMail).toHaveBeenCalledTimes(1);
      expect(mocks.sendMail.mock.calls[0][0]).toBe("staff@example.com");
      expect(mocks.sendSms).not.toHaveBeenCalled();
      expect(result.sentTo).toBe(maskEmail("staff@example.com"));
    });

    it("sends no code when the current password is wrong", async () => {
      useUsers(USER_REAL);
      mocks.signInWithPassword.mockResolvedValue({ data: null, error: new Error("Invalid login credentials") });

      await expect(requestPasswordChangeCode("user-real", "WrongPass123!")).rejects.toThrow("Current password is incorrect");

      expect(mocks.authOtpCreate).not.toHaveBeenCalled();
      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).not.toHaveBeenCalled();
    });

    it("texts the code to the stored phone of a phone-only account", async () => {
      useUsers(USER_PHONE);

      const result = await requestPasswordChangeCode("user-phone", "CurrentPass123!");

      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(mocks.sendSms).toHaveBeenCalledTimes(1);
      expect(mocks.sendSms.mock.calls[0][0]).toBe("+639171234567");
      expect(mocks.sendSms.mock.calls[0][1]).toMatch(/password change code is \d{6}/);
      expect(result.sentTo).toBe("0917****567");
    });

    it("reports a failed text instead of claiming the code was sent", async () => {
      useUsers(USER_PHONE);
      mocks.sendSms.mockResolvedValue({ success: false, error: "TEXTBEE_API_KEY not configured" });

      await expect(requestPasswordChangeCode("user-phone", "CurrentPass123!")).rejects.toThrow(
        "Failed to deliver the verification code. Please try again later."
      );
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    });
  });
});
