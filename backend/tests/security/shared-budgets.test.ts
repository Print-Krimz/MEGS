import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const backing = vi.hoisted(() => ({ counts: new Map<string, number>(), revoked: new Set<string>(), fail: false }));
vi.mock("../../src/security/shared-store.js", () => ({
  usesSharedStore: () => true,
  sharedCommand: async (...args: string[]) => {
    if (backing.fail) throw new Error("Fake shared store unavailable");
    if (args[0] === "SCRIPT") return "synthetic-sha";
    if (args[0] === "EVALSHA") {
      const key = args[3]!; const count = (backing.counts.get(key) || 0) + 1; backing.counts.set(key, count);
      return [count, Number(args[4]) || 900000];
    }
    if (args[0] === "SET") { backing.revoked.add(args[1]!); return "OK"; }
    if (args[0] === "EXISTS") return backing.revoked.has(args[1]!) ? 1 : 0;
    throw new Error("Unexpected test command");
  },
}));
import { operationLimiters, authIpLimiter, authAccountLimiter, authLimiter } from "../../src/middleware/rate-limiter.middleware.js";
import { isSessionRevoked, revokeSession } from "../../src/security/session-revocation.js";

const appWith = (handlers: any[], id = "staff-1") => {
  const app = express().use(express.json());
  app.use((req, _res, next) => { req.user = { id } as any; next(); });
  app.post("/operation", ...handlers, (_req, res) => res.json({ success: true }));
  app.use((_error: unknown, _req: any, res: any, _next: any) => res.status(503).json({ success: false }));
  return app;
};
describe("shared quotas and token revocation (mocked Redis transport)", () => {
  beforeEach(() => { backing.counts.clear(); backing.revoked.clear(); backing.fail = false; delete process.env.DISABLE_RATE_LIMIT; });
  it("shares one user's budget across two independent limiter instances and returns retry information", async () => {
    const first = appWith(operationLimiters("shared-test", 2, 10));
    const second = appWith(operationLimiters("shared-test", 2, 10));
    expect((await request(first).post("/operation")).status).toBe(200);
    expect((await request(second).post("/operation")).status).toBe(200);
    const denied = await request(first).post("/operation");
    expect(denied.status).toBe(429); expect(denied.body.retryAfter).toBeGreaterThan(0); expect(denied.headers["retry-after"]).toBeDefined();
  });
  it("bounds the global budget across different users", async () => {
    const one = appWith(operationLimiters("global-test", 10, 2), "one");
    const two = appWith(operationLimiters("global-test", 10, 2), "two");
    await request(one).post("/operation"); await request(two).post("/operation");
    expect((await request(two).post("/operation")).status).toBe(429);
  });
  it("does not bypass limits when shared storage fails", async () => {
    const app = appWith(operationLimiters("fail-test", 2, 10));
    await request(app).post("/operation"); backing.fail = true;
    expect((await request(app).post("/operation")).status).toBe(503);
  });
  it("changing email does not reset the separate IP budget", async () => {
    const app = appWith([authIpLimiter, authAccountLimiter, authLimiter]);
    for (let i = 0; i < 100; i++) expect((await request(app).post("/operation").send({ email: `person${i}@example.test` })).status).toBe(200);
    expect((await request(app).post("/operation").send({ email: "another@example.test" })).status).toBe(429);
    expect([...backing.counts.keys()].join(" ")).not.toContain("example.test");
  });
  it("revokes a token across imports without storing usable credentials", async () => {
    const token = "synthetic-access-token";
    expect(await isSessionRevoked(token)).toBe(false);
    await revokeSession(token, Date.now() / 1000 + 300);
    expect(await isSessionRevoked(token)).toBe(true);
    expect([...backing.revoked].join(" ")).not.toContain(token);
    backing.fail = true;
    await expect(isSessionRevoked(token)).rejects.toThrow();
  });
});
