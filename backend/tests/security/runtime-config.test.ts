import { describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";
import { allowedOrigins, isLocalBypassEnabled, proxyTrust, validateRuntimeSecurity } from "../../src/security/runtime-config.js";

const production = () => ({ NODE_ENV: "production", FRONTEND_URL: "https://megs.example", TRUST_PROXY: "false",
  REDIS_URL: "rediss://cache.example:6380", OTP_SECRET: "o".repeat(32), BACKUP_ENCRYPTION_SECRET: "b".repeat(32),
  TURNSTILE_SECRET_KEY: "synthetic", TURNSTILE_HOSTNAMES: "megs.example" });
describe("production security configuration", () => {
  it("accepts explicit dedicated production prerequisites", () => expect(() => validateRuntimeSecurity(production())).not.toThrow());
  it.each(["DISABLE_CAPTCHA", "DISABLE_RATE_LIMIT", "DISABLE_OTP", "DISABLE_MFA"])("rejects production %s and unknown runtime bypass", flag => {
    expect(() => validateRuntimeSecurity({ ...production(), [flag]: "true" })).toThrow();
    expect(isLocalBypassEnabled(flag, { NODE_ENV: "production", [flag]: "true" })).toBe(false);
    expect(isLocalBypassEnabled(flag, { [flag]: "true" })).toBe(false);
    expect(isLocalBypassEnabled(flag, { NODE_ENV: "test", [flag]: "true" })).toBe(true);
    expect(isLocalBypassEnabled(flag, { NODE_ENV: "development", [flag]: "true" })).toBe(true);
  });
  it.each(["OTP_SECRET", "BACKUP_ENCRYPTION_SECRET", "FRONTEND_URL", "REDIS_URL", "TRUST_PROXY", "TURNSTILE_HOSTNAMES"])("requires %s", key => {
    expect(() => validateRuntimeSecurity({ ...production(), [key]: "" })).toThrow();
  });
  it("rejects unknown runtime and blanket proxy trust", () => {
    expect(() => validateRuntimeSecurity({ NODE_ENV: "staging" })).toThrow();
    for (const TRUST_PROXY of ["true", "0.0.0.0/0", "::/0", "::ffff:0.0.0.0/96", "::ffff:0:0/96"]) expect(() => proxyTrust({ TRUST_PROXY })).toThrow();
  });
  it("supports the existing Turnstile secret alias", () => expect(() => validateRuntimeSecurity({ ...production(), TURNSTILE_SECRET_KEY: "", TURNSTILE_SECRET: "fake" })).not.toThrow());
  it("matches exact origins and approved previews without suffix wildcards", async () => {
    const origins = allowedOrigins({ ...production(), CORS_ALLOWED_ORIGINS: "https://approved-preview.example" });
    const app = express().use(cors({ origin: (origin, callback) => callback(null, !origin || origins.has(origin)) }));
    app.get("/stream", (_req, res) => res.send("ok"));
    const valid = await request(app).options("/stream").set("Origin", "https://approved-preview.example").set("Access-Control-Request-Headers", "authorization");
    expect(valid.headers["access-control-allow-origin"]).toBe("https://approved-preview.example");
    const invalid = await request(app).get("/stream").set("Origin", "https://megs.example.attacker.test");
    expect(invalid.headers["access-control-allow-origin"]).toBeUndefined();
    expect((await request(app).get("/stream")).status).toBe(200);
  });
  it("ignores forwarded IP without trust and stops at untrusted proxy addresses", async () => {
    const app = express(); app.set("trust proxy", proxyTrust({ TRUST_PROXY: "false" }));
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));
    expect((await request(app).get("/ip").set("X-Forwarded-For", "8.8.8.8")).body.ip).not.toBe("8.8.8.8");
    app.set("trust proxy", proxyTrust({ TRUST_PROXY: "loopback" }));
    expect((await request(app).get("/ip").set("X-Forwarded-For", "8.8.8.8, 192.0.2.10")).body.ip).toBe("192.0.2.10");
  });
});
