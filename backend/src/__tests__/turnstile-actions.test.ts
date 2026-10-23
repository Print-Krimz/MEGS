import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstile } from "../middleware/turnstile.middleware.js";

// Each protected form sends its own Turnstile action. Cloudflare echoes it back, and the
// middleware accepts the token only on the route that owns that action.
describe("verifyTurnstile form actions", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DISABLE_CAPTCHA: "false",
      TURNSTILE_SECRET_KEY: "dummy-secret",
      TURNSTILE_HOSTNAMES: "megs.example.ph",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  const run = async (path: string, action: string) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action, hostname: "megs.example.ph" }),
    } as any);
    const req = { method: "POST", path, headers: { "x-turnstile-token": "token" }, body: {}, ip: "127.0.0.1", socket: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    await verifyTurnstile(req, res, next);
    return { next, res };
  };

  it.each([
    ["/check-in", "check-in"],
    ["/claim/start", "claim"],
    ["/register", "signup"],
  ])("accepts %s with its own action", async (path, action) => {
    const { next, res } = await run(path, action);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a token made for another form", async () => {
    const { next, res } = await run("/check-in", "signup");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
