import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
const backing = vi.hoisted(() => ({ counts: new Map<string, number>(), revoked: new Set<string>(), fail: false }));
vi.mock("../../src/utils/prisma.js", () => ({ default: {
  $queryRaw: async (sql: TemplateStringsArray, ...args: any[]) => {
    if (backing.fail) throw new Error("Fake database unavailable");
    const text = sql.join("?");
    if (text.includes('INSERT INTO "SecurityCounter"')) {
      const key = args[0]; const hits = (backing.counts.get(key) || 0) + 1; backing.counts.set(key, hits);
      return [{ hits, expiresAt: new Date(Date.now() + args[1]) }];
    }
    if (text.includes('SELECT EXISTS')) return [{ revoked: backing.revoked.has(args[0]) }];
    throw new Error("Unexpected test query");
  },
  $executeRaw: async (_sql: TemplateStringsArray, key: string) => {
    if (backing.fail) throw new Error("Fake database unavailable");
    backing.revoked.add(key); return 1;
  },
} }));
import { operationLimiters, authIpLimiter, authAccountLimiter, authLimiter, forgotPasswordLimiter } from "../../src/middleware/rate-limiter.middleware.js";
import { isSessionRevoked, revokeSession } from "../../src/security/session-revocation.js";

const appWith = (handlers: any[], id = "staff-1") => {
  const app = express().use(express.json());
  app.use((req, _res, next) => { req.user = { id } as any; next(); });
  app.post("/operation", ...handlers, (_req, res) => res.json({ success: true }));
  app.use((_error: unknown, _req: any, res: any, _next: any) => res.status(503).json({ success: false }));
  return app;
};
describe("shared quotas and token revocation (mocked PostgreSQL transport)", () => {
  beforeEach(() => { backing.counts.clear(); backing.revoked.clear(); backing.fail = false; vi.stubEnv("DISABLE_RATE_LIMIT", "false"); vi.stubEnv("NODE_ENV", "production"); });
  afterEach(() => vi.unstubAllEnvs());
  it("shares one user's budget across two independent limiter instances and returns retry information", async () => {
    const first = appWith(operationLimiters("shared-test", 2, 10));
    const second = appWith(operationLimiters("shared-test", 2, 10));
    expect((await request(first).post("/operation")).status).toBe(200);
    expect((await request(second).post("/operation")).status).toBe(200);
    const denied = await request(first).post("/operation");
    expect(denied.status).toBe(429); expect(denied.body.retryAfter).toBeGreaterThan(0); expect(denied.headers["retry-after"]).toBeDefined();
  });
  it("honors the Heroku environment bypass after exhaustion and re-enforces the existing window", async () => {
    const app = appWith(operationLimiters("demo-toggle", 2, 10));
    await request(app).post("/operation"); await request(app).post("/operation");
    expect((await request(app).post("/operation")).status).toBe(429);
    const counts = new Map(backing.counts);
    vi.stubEnv("DISABLE_RATE_LIMIT", "true");
    for (let i = 0; i < 10; i++) expect((await request(app).post("/operation")).status).toBe(200);
    expect(backing.counts).toEqual(counts);
    vi.stubEnv("DISABLE_RATE_LIMIT", "false");
    expect((await request(app).post("/operation")).status).toBe(429);
  });
  it("bypasses mail, paired authentication, account and IP limits with the same developer flag", async () => {
    const app = appWith([authIpLimiter, authAccountLimiter, authLimiter, forgotPasswordLimiter]);
    vi.stubEnv("DISABLE_RATE_LIMIT", "true");
    for (let i = 0; i < 8; i++) expect((await request(app).post("/operation").send({ email: "demo@example.test" })).status).toBe(200);
    expect(backing.counts.size).toBe(0);
    vi.stubEnv("DISABLE_RATE_LIMIT", "false");
    expect((await request(app).post("/operation").send({ email: "demo@example.test" })).status).toBe(200);
    expect((await request(app).post("/operation").send({ email: "demo@example.test" })).status).toBe(200);
    expect((await request(app).post("/operation").send({ email: "demo@example.test" })).status).toBe(429);
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
  it("charges one account budget for email/identifier aliases, case and phone variants", async () => {
    const app = appWith([authLimiter]);
    const variants = [
      { email: "Demo@Example.test" }, { identifier: "demo@example.test" },
      { email: "demo@example.test", identifier: " DEMO@example.test " },
      { identifier: "09171234567" }, { identifier: "+63 917 123 4567" },
    ];
    for (const body of variants.slice(0, 3)) expect((await request(app).post("/operation").send(body)).status).toBe(200);
    expect((await request(app).post("/operation").send({ identifier: "DEMO@example.test" })).status).toBe(200);
    expect((await request(app).post("/operation").send({ email: "demo@example.test" })).status).toBe(200);
    expect((await request(app).post("/operation").send({ identifier: "demo@example.test" })).status).toBe(429);
    backing.counts.clear();
    await request(app).post("/operation").send(variants[3]); await request(app).post("/operation").send(variants[4]);
    expect([...backing.counts.values()]).toEqual([2]);
  });
  it("falls back to the IP budget for conflicting or malformed identifiers", async () => {
    const app = appWith([authLimiter]);
    await request(app).post("/operation").send({ email: "decoy@example.test", identifier: "victim@example.test" });
    await request(app).post("/operation").send({ identifier: "not valid" });
    await request(app).post("/operation").send({ identifier: "x".repeat(5000) });
    await request(app).post("/operation").send({});
    expect(backing.counts.size).toBe(1);
  });
  it("validation accepts aliases and rejects conflicts with 400", async () => {
    const { validate } = await import("../../src/middleware/validate.middleware.js");
    const { authSchema } = await import("../../src/schemas/auth.schema.js");
    const app = express().use(express.json());
    app.post("/login", validate(authSchema.login), (req, res) => res.json(req.body));
    const ok = await request(app).post("/login").send({ identifier: "09171234567", email: "+639171234567", password: "pw" });
    expect(ok.status).toBe(200); expect(ok.body.email).toBe("+639171234567"); expect(ok.body.identifier).toBe("+639171234567");
    const idOnly = await request(app).post("/login").send({ identifier: "Demo@Example.test", password: "pw" });
    expect(idOnly.body.identifier).toBe("demo@example.test");
    const bad = await request(app).post("/login").send({ email: "decoy@example.test", identifier: "victim@example.test", password: "pw" });
    expect(bad.status).toBe(400);
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
