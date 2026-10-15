import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../../src/middleware/turnstile.middleware.js";

describe("CAPTCHA site and action binding", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISABLE_CAPTCHA", "false");
    vi.stubEnv("TURNSTILE_SECRET", "fake-test-secret");
    vi.stubEnv("TURNSTILE_HOSTNAMES", "megs.example.com");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  async function request(outcome: unknown, path = "/login", method = "POST") {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => outcome }));
    const next = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await verifyTurnstile({ path, method, headers: { "x-turnstile-token": "fake-response" }, ip: "127.0.0.1" } as any, res as any, next);
    return { next, res };
  }
  it.each([["/login", "login"], ["/register", "signup"], ["/forgot-password", "forgot_password"]])(
    "accepts the existing widget action for %s", async (path, action) => {
      expect((await request({ success: true, action, hostname: "megs.example.com" }, path)).next).toHaveBeenCalledOnce();
    });
  it.each([
    { success: true, action: "signup", hostname: "megs.example.com" },
    { success: true, hostname: "megs.example.com" },
    { success: true, action: "login" },
    { success: true, action: "login", hostname: "attacker.example.com" },
    { success: "true", action: "login", hostname: "megs.example.com" },
  ])("fails closed on wrong/missing bindings", async (outcome) => {
    const { res, next } = await request(outcome);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("does not accept route suffixes, wrong methods or an empty hostname configuration", async () => {
    const valid = { success: true, action: "login", hostname: "megs.example.com" };
    expect((await request(valid, "/login/anything")).next).not.toHaveBeenCalled();
    expect((await request(valid, "/login", "GET")).next).not.toHaveBeenCalled();
    vi.stubEnv("TURNSTILE_HOSTNAMES", "");
    expect((await request(valid)).next).not.toHaveBeenCalled();
  });
});
