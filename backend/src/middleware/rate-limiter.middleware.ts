import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";

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
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
  keyGenerator: authKeyGenerator,
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
  skip: () => process.env.DISABLE_RATE_LIMIT === "true",
  keyGenerator: emailKeyGenerator,
  handler: rateLimitHandler("Too many password reset requests. Please wait an hour before requesting again.", 3600),
});
