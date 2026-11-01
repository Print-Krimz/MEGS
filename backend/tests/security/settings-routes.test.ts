import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const m = vi.hoisted(() => ({ user: vi.fn(), revoked: vi.fn(), token: vi.fn(), settings: vi.fn(), update: vi.fn() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: { user: { findUnique: m.user } } }));
vi.mock("../../src/security/auth-token.js", () => ({ verifyAccessToken: m.token }));
vi.mock("../../src/security/session-revocation.js", () => ({ isSessionRevoked: m.revoked }));
vi.mock("../../src/security/security-controls.js", () => ({ getSecurityControls: vi.fn().mockResolvedValue({ mfaDisabled: true }) }));
vi.mock("../../src/middleware/rate-limiter.middleware.js", () => ({ settingsLimiters: [] }));
vi.mock("../../src/services/core/settings.service.js", () => ({ getSettings: m.settings, updateProfile: m.update, SettingsAccessError: class extends Error {} }));
import routes from "../../src/routes/core/settings.routes.js";
const app = express().use(express.json()).use("/api/settings", routes);
beforeEach(() => { vi.clearAllMocks(); m.token.mockResolvedValue({ sub: "self", aal: "aal2" }); m.revoked.mockResolvedValue(false); m.user.mockResolvedValue({ id: "self", email: "a@example.com", role: "TALENT_ACQUISITION", isActive: true, accountStatus: "ACTIVE", mustChangePassword: false }); m.update.mockResolvedValue({ displayName: "Ada" }); });
describe("settings authorization", () => {
  it("rejects applicants and forged fields", async () => {
    m.user.mockResolvedValueOnce({ id: "self", role: "APPLICANT", isActive: true, accountStatus: "ACTIVE" });
    expect((await request(app).patch("/api/settings/profile").set("Authorization", "Bearer token").send({ displayName: "Ada" })).status).toBe(403);
    expect((await request(app).patch("/api/settings/profile").set("Authorization", "Bearer token").send({ displayName: "Ada", id: "other" })).status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("uses the authenticated id for an allowed update", async () => {
    expect((await request(app).patch("/api/settings/profile").set("Authorization", "Bearer token").send({ displayName: "Ada" })).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("self", "Ada");
  });
  it("rejects revoked, inactive and forced-change sessions", async () => {
    m.revoked.mockResolvedValueOnce(true);
    expect((await request(app).get("/api/settings").set("Authorization", "Bearer token")).status).toBe(401);
    m.user.mockResolvedValueOnce({ id: "self", role: "APPLICANT", isActive: false, accountStatus: "ACTIVE" });
    expect((await request(app).get("/api/settings").set("Authorization", "Bearer token")).status).toBe(403);
    m.user.mockResolvedValueOnce({ id: "self", role: "APPLICANT", isActive: true, accountStatus: "ACTIVE", mustChangePassword: true });
    expect((await request(app).get("/api/settings").set("Authorization", "Bearer token")).status).toBe(403);
  });
});
