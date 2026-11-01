import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const state = vi.hoisted(() => ({ counts: new Map<string, number>(), increments: [] as string[], windows: new Map<string, number>() }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {} }));
vi.mock("../../src/services/core/security-alert.service.js", () => ({ notifySecurityEvent: vi.fn(), notifyClaimProbe: vi.fn() }));
vi.mock("../../src/security/shared-store.js", () => ({
  PostgresRateLimitStore: class {
    localKeys = true;
    constructor(private name: string) {}
    init(options: { windowMs: number }) { state.windows.set(this.name, options.windowMs); }
    async increment(key: string) {
      const full = `${this.name}:${key}`; state.increments.push(full);
      const totalHits = (state.counts.get(full) ?? 0) + 1; state.counts.set(full, totalHits);
      return { totalHits, resetTime: new Date(Date.now() + 900000) };
    }
    async decrement() {} async resetKey() {}
  },
}));
import { settingsLimiters } from "../../src/middleware/rate-limiter.middleware.js";
const app = express().set("trust proxy", true).use((req, _res, next) => { req.user = { id: String(req.headers["x-user"]), email: "a@b.co", role: "ADMINISTRATOR" }; next(); }).use(...settingsLimiters).get("/", (_req, res) => res.sendStatus(204));
const hit = (user = "one", ip = "1.2.3.4") => request(app).get("/").set("X-User", user).set("X-Forwarded-For", ip);
beforeEach(() => { state.counts.clear(); state.increments.length = 0; delete process.env.DISABLE_RATE_LIMIT; });
describe("real settings quotas", () => {
  it("limits each user to 120 independently", async () => {
    expect(state.windows.get("settings-user")).toBe(900000);
    expect(state.windows.get("settings-ip")).toBe(900000);
    expect(state.windows.get("settings-global")).toBe(900000);
    expect((await hit()).status).toBe(204);
    const key = state.increments.find((key) => key.startsWith("settings-user:"))!;
    state.counts.set(key, 120);
    expect((await hit()).status).toBe(429);
    expect((await hit("two")).status).toBe(204);
  });
  it("limits one IP at 720 and has a distinct global limit of 2400", async () => {
    await hit();
    const ip = state.increments.find((key) => key.startsWith("settings-ip:"))!;
    const global = state.increments.find((key) => key.startsWith("settings-global:"))!;
    state.counts.set(ip, 720);
    expect((await hit("two")).status).toBe(429);
    state.counts.set(global, 2400);
    expect((await hit("three", "2.3.4.5")).status).toBe(429);
    expect(state.increments.every((key) => key.startsWith("settings-"))).toBe(true);
  });
});
