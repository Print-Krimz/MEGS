import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { PostgresRateLimitStore } from "../security/shared-store.js";
import { resolveAuthIdentifier } from "../schemas/auth.schema.js";
import { notifySecurityEvent, notifyClaimProbe, type SecurityEvent } from "../services/core/security-alert.service.js";
// Same developer switch as main MEGS. It applies in hosted production/Heroku.
const skipDisabled = () => process.env.DISABLE_RATE_LIMIT === "true";
const securityStore = (name: string) => new PostgresRateLimitStore(name);
// Keep the initial corrective-patch counter namespace. Disabling skips charges;
// re-enabling resumes existing windows, which persist across dyno restarts.
const quotaKey = (key: string) => `0:${key}`;
const hashIdentity = (value: string) => createHash("sha256").update(value).digest("hex");
export const clientIp = (req: Request) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "127.0.0.1");

const limiter = (name: string, max: number, windowMs: number, keyGenerator: (req: Request) => string, onLimit?: (req: Request) => void) => rateLimit({
  windowMs, max, keyGenerator: req => quotaKey(keyGenerator(req)), store: securityStore(name),
  skip: skipDisabled, standardHeaders: true, legacyHeaders: false, passOnStoreError: false,
  handler: rateLimitHandler("Too many requests. Please retry after the indicated delay.", Math.ceil(windowMs / 1000), onLimit),
});

/**
 * Standard RFC rate-limit response handler following MEGS unified response shape.
 */
export const rateLimitHandler = (message: string, defaultRetrySeconds: number = 900, onLimit?: (req: Request) => void) => {
  return (req: Request, res: Response) => {
    const retryAfter = res.getHeader("Retry-After");
    const retrySeconds = retryAfter ? Number(retryAfter) : defaultRetrySeconds;

    res.status(429).json({
      success: false,
      message,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: retrySeconds,
    });
    // Runs after the response so the body is the same for known and unknown accounts.
    try {
      onLimit?.(req);
    } catch (e) {
      console.error("[RATE LIMIT ALERT]", e instanceof Error ? e.message : e);
    }
  };
};

/**
 * Key generator combining client IP and lowercase email to mitigate distributed credential stuffing
 * while preventing single-IP collateral blocking when multiple users share an office gateway.
 */
const alertIdentifier = (event: SecurityEvent) => (req: Request) => {
  const identifier = resolveAuthIdentifier(req.body).value;
  if (identifier) notifySecurityEvent({ identifier }, event, { ip: req.ip }).catch(console.error);
};
const alertClaimProbe = (req: Request) => {
  notifyClaimProbe(String(req.body?.phone ?? ""), req.ip).catch(console.error);
};
const alertAuthLimit = (req: Request) => {
  if (req.path.startsWith("/claim")) alertClaimProbe(req);
  else alertIdentifier("SIGN_IN_LIMITED")(req);
};

export const authKeyGenerator = (req: Request): string => {
  const email = resolveAuthIdentifier(req.body).value ?? "";
  const rawIp = req.ip || req.socket?.remoteAddress || "127.0.0.1";
  const ip = ipKeyGenerator(rawIp);
  return email ? `${ip}_${email}` : ip;
};

/**
 * Key generator strictly keyed by normalized email (fallback to IP) for sensitive mail triggers.
 */
export const emailKeyGenerator = (req: Request): string => {
  const email = resolveAuthIdentifier(req.body).value ?? "";
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
  skip: skipDisabled,
  store: securityStore("auth-pair"),
  keyGenerator: req => quotaKey(hashIdentity(authKeyGenerator(req))),
  handler: rateLimitHandler("Too many authentication attempts. Please try again after 15 minutes.", 900, alertAuthLimit),
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
  skip: skipDisabled,
  store: securityStore("mail-account"),
  keyGenerator: req => quotaKey(hashIdentity(emailKeyGenerator(req))),
  handler: rateLimitHandler("Too many password reset requests. Please wait an hour before requesting again.", 3600, alertIdentifier("RESET_LIMITED")),
});

// Separate budgets prevent changing an email/IP from resetting every counter.
export const authIpLimiter = limiter("auth-ip", 100, 15 * 60 * 1000, clientIp);
export const authAccountLimiter = limiter("auth-account", 30, 15 * 60 * 1000,
  req => hashIdentity(resolveAuthIdentifier(req.body).value || String(req.user?.id || clientIp(req)).toLowerCase().trim()));

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

// Account claim: a second budget per mobile number, so one number cannot be probed or texted
// repeatedly from many addresses. The IP budget (authLimiter) still applies on top.
const claimPhoneKey = (req: Request): string => {
  const digits = String(req.body?.phone ?? "").replace(/\D/g, "").slice(-10);
  return digits ? hashIdentity(`claim_phone_${digits}`) : clientIp(req);
};
export const claimPhoneLimiter = limiter("claim-phone", 5, 15 * 60 * 1000, claimPhoneKey, alertClaimProbe);

// Public no-login pages (QR tracker, offer links): per-IP, 60 requests per 15 minutes.
export const publicLimiter = limiter("public-ip", 60, 15 * 60 * 1000, clientIp);

// Wrong-token probes on the live streams: successful streams and their reconnects are not counted.
export const streamFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, keyGenerator: req => quotaKey(clientIp(req)), store: securityStore("public-stream-fail"),
  skip: skipDisabled, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, passOnStoreError: false,
  handler: rateLimitHandler("Too many requests. Please retry after the indicated delay.", 900),
});
export const settingsLimiters = operationLimiters("settings", 120, 2400, 15 * 60 * 1000);
