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
    req.body?.turnstileToken;

  if (!token) {
    res.status(400).json({
      success: false,
      message: "Security verification required. Please complete the CAPTCHA.",
    });
    return;
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.error("[Turnstile] Missing TURNSTILE_SECRET_KEY in environment");
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
    });

    const outcome = (await cfResponse.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!outcome.success) {
      res.status(400).json({
        success: false,
        message: "Security verification failed. Please try again.",
        errors: outcome["error-codes"],
      });
      return;
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
