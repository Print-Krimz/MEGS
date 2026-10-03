import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
vi.mock("../../src/controllers/core/auth.controller.js", () => {
  const noop = (_req: unknown, res: any) => res.json({ success: true });
  return { register: noop, verifyOtp: noop, resendOtp: noop, login: noop, logout: noop, forgotPassword: noop,
    resetPassword: noop, changePassword: noop, setupAccount: noop, getInvitationDetails: noop };
});
vi.mock("../../src/controllers/core/mfa.controller.js", () => ({
  enrollMfaHandler: vi.fn(), verifyMfaEnrollmentHandler: vi.fn(), verifyMfaLoginHandler: vi.fn(), verifyMfaRecoveryHandler: vi.fn(), getMfaStatusHandler: vi.fn(),
}));
vi.mock("../../src/middleware/auth.middleware.js", () => ({ authenticateJWT: (req: any, res: any, next: any) => {
  if (!req.headers.authorization) { res.status(401).json({ success: false }); return; }
  req.user = { id: "owner" }; next();
} }));
vi.mock("../../src/middleware/rate-limiter.middleware.js", () => {
  const deny = (_req: unknown, res: any) => res.status(429).json({ success: false });
  return { authLimiter: deny, forgotPasswordLimiter: deny, authIpLimiter: deny, authAccountLimiter: deny };
});
vi.mock("../../src/middleware/turnstile.middleware.js", () => ({ verifyTurnstile: vi.fn() }));
import authRoutes from "../../src/routes/core/auth.routes.js";

describe("logout stays reachable when auth quotas are exhausted", () => {
  it("allows authenticated logout while limiting login, and still rejects unauthenticated logout", async () => {
    const app = express().use(express.json()).use("/api/auth", authRoutes);
    expect((await request(app).post("/api/auth/login")).status).toBe(429);
    expect((await request(app).post("/api/auth/logout").set("Authorization", "Bearer synthetic")).status).toBe(200);
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
  });
});
