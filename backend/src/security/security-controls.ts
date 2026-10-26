export interface SecurityControls {
  mfaDisabled: boolean;
  otpDisabled: boolean;
  rateLimitDisabled: boolean;
  captchaDisabled: boolean;
  /** Demo only: lets TA end an active assignment before its recorded start date. */
  earlyAssignmentEndAllowed: boolean;
}

// Developer-owned configuration, matching the main MEGS repository's flags.
// Heroku exposes Config Vars through process.env even with NODE_ENV=production.
// No application role, request payload or database row can override these values.
export const getSecurityControls = (): SecurityControls => ({
  mfaDisabled: process.env.DISABLE_MFA === "true",
  otpDisabled: process.env.DISABLE_OTP === "true",
  rateLimitDisabled: process.env.DISABLE_RATE_LIMIT === "true",
  captchaDisabled: process.env.DISABLE_CAPTCHA === "true",
  // Temporary demo switch. Unset DEMO_ALLOW_EARLY_END to restore the start-date guard.
  earlyAssignmentEndAllowed: process.env.DEMO_ALLOW_EARLY_END === "true",
});
