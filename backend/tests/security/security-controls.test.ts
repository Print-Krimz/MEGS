import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), audit: vi.fn(), user: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  $queryRaw: db.query, $executeRaw: db.execute, user: { findUnique: db.user }, auditLog: { create: db.audit },
} }));
vi.mock("../../src/utils/supabase.js", () => ({ default: {} }));
vi.mock("../../src/security/auth-token.js", () => ({ verifyAccessToken: vi.fn().mockResolvedValue({ sub: "admin", aal: "aal2", exp: Date.now() / 1000 + 300 }) }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: vi.fn().mockResolvedValue(false) }));
import { getSecurityControls } from "../../src/security/security-controls.js";
import configRoutes from "../../src/routes/core/config.routes.js";
import adminRoutes from "../../src/routes/admin/admin.routes.js";

const app = express().use(express.json()).use("/api/config", configRoutes).use("/api/admin", adminRoutes);
describe("developer-owned configuration in hosted production", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production");
    for (const flag of ["DISABLE_MFA", "DISABLE_OTP", "DISABLE_RATE_LIMIT"]) vi.stubEnv(flag, "false");
    db.user.mockResolvedValue({ id: "admin", role: "ADMINISTRATOR", email: "admin@example.test", isActive: true,
      accountStatus: "ACTIVE", mustChangePassword: false });
    db.query.mockRejectedValue(new Error("No database configuration access permitted"));
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each([
    ["DISABLE_MFA", "mfaDisabled"], ["DISABLE_OTP", "otpDisabled"], ["DISABLE_RATE_LIMIT", "rateLimitDisabled"],
  ] as const)("honors Heroku-style %s independently and restores enforcement", (flag, key) => {
    vi.stubEnv(flag, "true"); expect(getSecurityControls()[key]).toBe(true);
    for (const other of ["mfaDisabled", "otpDisabled", "rateLimitDisabled"] as const) if (other !== key) expect(getSecurityControls()[other]).toBe(false);
    vi.stubEnv(flag, "false"); expect(getSecurityControls()[key]).toBe(false);
    expect(db.query).not.toHaveBeenCalled(); expect(db.execute).not.toHaveBeenCalled();
  });
  it("keeps controls enabled when flags are unset or are not the literal true", () => {
    for (const value of [undefined, "false", "TRUE", "1", ""]) {
      for (const flag of ["DISABLE_MFA", "DISABLE_OTP", "DISABLE_RATE_LIMIT"]) vi.stubEnv(flag, value);
      expect(getSecurityControls()).toEqual({ mfaDisabled: false, otpDisabled: false, rateLimitDisabled: false });
    }
  });
  it("exposes only read-only booleans for pending demo forms", async () => {
    vi.stubEnv("DISABLE_OTP", "true");
    const response = await request(app).get("/api/config/security");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ mfaDisabled: false, otpDisabled: true, rateLimitDisabled: false });
    expect(db.query).not.toHaveBeenCalled(); expect(db.audit).not.toHaveBeenCalled();
  });
  it("denies settings mutation even to a valid MEGS administrator", async () => {
    for (const method of ["patch", "post", "put"] as const) {
      const result = await request(app)[method]("/api/admin/security-controls").set("Authorization", "Bearer verified")
        .send({ expectedRevision: 0, mfaDisabled: true, otpDisabled: true, rateLimitDisabled: true });
      expect(result.status).toBe(404);
    }
    expect(getSecurityControls()).toEqual({ mfaDisabled: false, otpDisabled: false, rateLimitDisabled: false });
    expect(db.execute).not.toHaveBeenCalled(); expect(db.audit).not.toHaveBeenCalled();
  });
  it("does not accept control changes through the public status endpoint", async () => {
    for (const method of ["patch", "post", "put"] as const) {
      expect((await request(app)[method]("/api/config/security").send({ rateLimitDisabled: true })).status).toBe(404);
    }
    expect(getSecurityControls().rateLimitDisabled).toBe(false);
  });
});
