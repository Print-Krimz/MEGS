import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const checks = vi.hoisted(() => ({ verify: vi.fn(), revoked: vi.fn(), controls: vi.fn(), user: vi.fn() }));
vi.mock("../../src/security/auth-token.js", () => ({ verifyAccessToken: checks.verify }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: checks.revoked }));
vi.mock("../../src/security/security-controls.js", () => ({ getSecurityControls: checks.controls }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: checks.user } } }));
import { continueWithoutMfa } from "../../src/controllers/core/mfa-continue.controller.js";
const app = express().use(express.json()).post("/continue", continueWithoutMfa);
describe("pending staff MFA continuation", () => {
  beforeEach(() => {
    vi.clearAllMocks(); checks.verify.mockResolvedValue({ sub: "staff", aal: "aal1", exp: Date.now() / 1000 + 300 });
    checks.revoked.mockResolvedValue(false); checks.controls.mockResolvedValue({ mfaDisabled: true });
    checks.user.mockResolvedValue({ id: "staff", role: "ADMINISTRATOR", isActive: true, accountStatus: "ACTIVE", mustChangePassword: false });
  });
  it("returns only the existing verified session while disabled; re-enable rejects it", async () => {
    const continued = await request(app).post("/continue").send({ token: "existing-password-session" });
    expect(continued.status).toBe(200); expect(continued.body.data.access_token).toBe("existing-password-session");
    expect(continued.body.data).not.toHaveProperty("aal");
    checks.controls.mockResolvedValue({ mfaDisabled: false });
    expect((await request(app).post("/continue").send({ token: "existing-password-session" })).status).toBe(403);
  });
  it("rejects invalid, revoked and inactive sessions even while MFA is disabled", async () => {
    checks.verify.mockRejectedValueOnce(new Error("bad token"));
    expect((await request(app).post("/continue").send({ token: "bad" })).status).toBe(401);
    checks.revoked.mockResolvedValueOnce(true);
    expect((await request(app).post("/continue").send({ token: "revoked" })).status).toBe(401);
    checks.user.mockResolvedValue({ role: "ADMINISTRATOR", isActive: false, accountStatus: "ACTIVE" });
    expect((await request(app).post("/continue").send({ token: "inactive" })).status).toBe(403);
  });
});
