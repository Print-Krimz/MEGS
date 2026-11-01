import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const m = vi.hoisted(() => ({ user: vi.fn(), login: vi.fn(), refresh: vi.fn(), getUser: vi.fn(), enroll: vi.fn(), verify: vi.fn(), recovery: vi.fn(), reset: vi.fn(), controls: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: m.user } } }));
vi.mock("../../src/utils/supabase.js", () => ({ default: { auth: { signInWithPassword: m.login, refreshSession: m.refresh, getUser: m.getUser } } }));
vi.mock("../../src/utils/audit.js", () => ({ logAudit: vi.fn() }));
vi.mock("../../src/utils/mailer.js", () => ({ sendMail: vi.fn(), sendRegistrationOtpEmail: vi.fn(), sendPasswordResetOtpEmail: vi.fn(), redactAuthenticationSecrets: (v: string) => v }));
vi.mock("../../src/utils/otp.js", () => ({ generateNumericOtp: vi.fn(), hashOtp: vi.fn(), verifyOtpHash: vi.fn(), generateSecureToken: vi.fn(), hashToken: vi.fn() }));
vi.mock("../../src/services/applicant/applicant.service.js", () => ({ ensureApplicantProfile: vi.fn() }));
vi.mock("../../src/services/core/mfa.service.js", () => ({ verifyMfaEnrollment: m.enroll, verifyMfaLogin: m.verify, verifyRecoveryCode: m.recovery, resetMfaAfterRecovery: m.reset, getUserMfaFactors: vi.fn(), enrollMfa: vi.fn(), resetUserMfa: vi.fn(), createMfaChallenge: vi.fn() }));
vi.mock("../../src/security/auth-token.js", () => ({ verifyAccessToken: vi.fn().mockResolvedValue({ sub: "self", aal: "aal2", exp: 9999999999 }) }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: vi.fn().mockResolvedValue(false) }));
vi.mock("../../src/security/security-controls.js", () => ({ getSecurityControls: m.controls }));
import { loginUser, refreshUserSession } from "../../src/services/core/auth.service.js";
import { verifyMfaEnrollmentHandler, verifyMfaLoginHandler, verifyMfaRecoveryHandler } from "../../src/controllers/core/mfa.controller.js";
import { continueWithoutMfa } from "../../src/controllers/core/mfa-continue.controller.js";
import { authenticateJWT } from "../../src/middleware/auth.middleware.js";
import { sendSuccess } from "../../src/utils/response.js";
const user = { id: "self", email: "a@b.co", displayName: "李 明", role: "ADMINISTRATOR", isActive: true, accountStatus: "ACTIVE", mustChangePassword: false };
const session = { access_token: "a", refresh_token: "r", expires_in: 3600 };
const app = express().use(express.json()).post("/enroll", verifyMfaEnrollmentHandler).post("/verify", verifyMfaLoginHandler).post("/recover", verifyMfaRecoveryHandler).post("/continue", continueWithoutMfa).get("/me", authenticateJWT, (req, res) => sendSuccess(res, "Token is valid", { user: req.user }));
beforeEach(() => {
  vi.clearAllMocks(); m.controls.mockResolvedValue({ mfaDisabled: true }); m.user.mockResolvedValue(user);
  m.login.mockResolvedValue({ data: { user, session }, error: null }); m.refresh.mockResolvedValue({ data: { user, session }, error: null });
  m.getUser.mockResolvedValue({ data: { user }, error: null }); m.enroll.mockResolvedValue({ message: "ok", recoveryCodes: [], session }); m.verify.mockResolvedValue(session); m.recovery.mockResolvedValue({ remainingCodes: 2 }); m.reset.mockResolvedValue(undefined);
});
describe("session displayName projections", () => {
  it("returns it in login and refresh with Prisma selecting the field", async () => {
    expect((await loginUser(user.email, "password")).user.displayName).toBe(user.displayName);
    expect(m.user).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.objectContaining({ displayName: true }) }));
    expect((await refreshUserSession("r"))?.user.displayName).toBe(user.displayName);
    expect(m.user).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.objectContaining({ displayName: true }) }));
  });
  it.each(["enroll", "verify", "recover", "continue"])("returns it through %s", async (path) => {
    const response = await request(app).post(`/${path}`).send({ token: "token", factorId: "f", challengeId: "c", code: "123456", recoveryCode: "abc" });
    expect(response.status).toBe(200); expect(response.body.data.user.displayName).toBe(user.displayName);
    expect(m.user).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.objectContaining({ displayName: true }) }));
  });
  it("attaches it to the /me response via real authentication middleware", async () => {
    const response = await request(app).get("/me").set("Authorization", "Bearer token");
    expect(response.status).toBe(200); expect(response.body.data.user.displayName).toBe(user.displayName);
    expect(m.user).toHaveBeenLastCalledWith(expect.objectContaining({ select: expect.objectContaining({ displayName: true }) }));
  });
});
