import type { Request, Response, NextFunction } from "express";

/**
 * Cloudflare Turnstile CAPTCHA Verification Middleware
 *
 * Verifies the turnstile token supplied in `x-turnstile-token` header or `req.body.turnstileToken`.
 * Automatically bypasses verification in test environments (`NODE_ENV === "test"` or `DISABLE_CAPTCHA === "true"`).
 */
export async function verifyTurnstile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Allow test environments and explicit disable flag to bypass
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_CAPTCHA === "true") {
    return next();
  }

  const token =
    (req.headers["x-turnstile-token"] as string) ||
    req.body?.turnstileToken ||
    req.body?.["cf-turnstile-response"];

  if (!token || typeof token !== "string" || token.length === 0 || token.length > 2048) {
    res.status(403).json({
      success: false,
      message: "Security verification required. Please complete the CAPTCHA.",
    });
    return;
  }

  const secretKey = process.env.TURNSTILE_SECRET || process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("[Turnstile] Missing TURNSTILE_SECRET in environment");
    res.status(500).json({
      success: false,
      message: "Captcha verification service misconfigured.",
    });
    return;
  }

  try {
    const remoteIp = req.ip || req.socket?.remoteAddress || "";
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const cfResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const outcome = (await cfResponse.json()) as {
      success: boolean;
      "error-codes"?: string[];
      action?: string;
      hostname?: string;
    };

    if (!outcome.success) {
      res.status(403).json({
        success: false,
        message: "Security verification failed. Please try again.",
        errors: outcome["error-codes"],
      });
      return;
    }

    // If allowed hostnames are configured, enforce matching frontend hostname
    const rawAllowedHostnames = process.env.TURNSTILE_HOSTNAMES;
    if (rawAllowedHostnames && outcome.hostname) {
      const allowedSet = new Set(
        rawAllowedHostnames
          .split(",")
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean)
      );
      if (allowedSet.size > 0 && !allowedSet.has(outcome.hostname.toLowerCase())) {
        console.warn(`[Turnstile] Hostname mismatch: got '${outcome.hostname}', expected one of ${Array.from(allowedSet).join(", ")}`);
        res.status(403).json({
          success: false,
          message: "Security verification hostname mismatch.",
        });
        return;
      }
    }

    next();
  } catch (error) {
    console.error("[Turnstile] Error verifying token with Cloudflare:", error);
    res.status(500).json({
      success: false,
      message: "Unable to verify security challenge. Please try again later.",
    });
  }
}
