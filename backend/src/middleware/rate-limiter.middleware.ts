import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { RedisStore } from "rate-limit-redis";
import { sharedCommand, usesSharedStore } from "../security/shared-store.js";
import { isLocalBypassEnabled } from "../security/runtime-config.js";

const securityStore = (name: string) => usesSharedStore() ? new RedisStore({
  prefix: `megs:rate:${name}:`, sendCommand: sharedCommand,
}) : undefined;
const skipLocally = () => isLocalBypassEnabled("DISABLE_RATE_LIMIT");
const hashIdentity = (value: string) => createHash("sha256").update(value).digest("hex");
const clientIp = (req: Request) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "127.0.0.1");

const limiter = (name: string, max: number, windowMs: number, keyGenerator: (req: Request) => string) => rateLimit({
  windowMs, max, keyGenerator, store: securityStore(name),
  skip: skipLocally, standardHeaders: true, legacyHeaders: false, passOnStoreError: false,
  handler: rateLimitHandler("Too many requests. Please retry after the indicated delay.", Math.ceil(windowMs / 1000)),
});

/**
 * Standard RFC rate-limit response handler following MEGS unified response shape.
 */
export const rateLimitHandler = (message: string, defaultRetrySeconds: number = 900) => {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader("Retry-After");
    const retrySeconds = retryAfter ? Number(retryAfter) : defaultRetrySeconds;

    res.status(429).json({
      success: false,
      message,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: retrySeconds,
    });
  };
};

/**
 * Key generator combining client IP and lowercase email to mitigate distributed credential stuffing
 * while preventing single-IP collateral blocking when multiple users share an office gateway.
 */
export const authKeyGenerator = (req: Request): string => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "";
  const rawIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const ip = ipKeyGenerator(rawIp);
  return email ? `${ip}_${email}` : ip;
};

/**
 * Key generator strictly keyed by normalized email (fallback to IP) for sensitive mail triggers.
 */
export const emailKeyGenerator = (req: Request): string => {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : "";
  if (email) {
    return `mail_${email}`;
  }
  const rawIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const ip = ipKeyGenerator(rawIp);
  return `ip_${ip}`;
};

/**
 * Strict authentication limiter (Login, Registration, Token Resets, Setup Account, Change Password).
 * Limits to 5 requests per 15 minutes per IP+Email.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocally,
  store: securityStore("auth-pair"),
  keyGenerator: req => hashIdentity(authKeyGenerator(req)),
  handler: rateLimitHandler("Too many authentication attempts. Please try again after 15 minutes.", 900),
});

/**
 * High-sensitivity limiter for Password Reset requests to prevent SMTP abuse and email flooding.
 * Limits to 2 requests per 60 minutes per Email/IP.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipLocally,
  store: securityStore("mail-account"),
  keyGenerator: req => hashIdentity(emailKeyGenerator(req)),
  handler: rateLimitHandler("Too many password reset requests. Please wait an hour before requesting again.", 3600),
});

// Separate budgets prevent changing an email/IP from resetting every counter.
export const authIpLimiter = limiter("auth-ip", 100, 15 * 60 * 1000, clientIp);
export const authAccountLimiter = limiter("auth-account", 30, 15 * 60 * 1000,
  req => hashIdentity(String(req.body?.email || req.user?.id || clientIp(req)).toLowerCase().trim()));

export const operationLimiters = (name: string, perUser: number, global: number, windowMs = 60 * 60 * 1000) => [
  limiter(`${name}-user`, perUser, windowMs, req => hashIdentity(req.user?.id || clientIp(req))),
  limiter(`${name}-ip`, perUser * 6, windowMs, clientIp),
  limiter(`${name}-global`, global, windowMs, () => "budget"),
];
export const aiLimiters = operationLimiters("ai", 20, 200);
export const reportLimiters = operationLimiters("reports", 30, 600);
export const maintenanceLimiters = operationLimiters("maintenance", 6, 24);
export const scoringLimiters = operationLimiters("scoring-revalidation", 6, 24);
export const analyticsLimiters = operationLimiters("analytics", 180, 3000, 15 * 60 * 1000);
