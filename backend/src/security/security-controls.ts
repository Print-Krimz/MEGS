export interface SecurityControls {
  mfaDisabled: boolean;
  otpDisabled: boolean;
  rateLimitDisabled: boolean;
}

// Developer-owned configuration, matching the main MEGS repository's flags.
// Heroku exposes Config Vars through process.env even with NODE_ENV=production.
// No application role, request payload or database row can override these values.
export const getSecurityControls = (): SecurityControls => ({
  mfaDisabled: process.env.DISABLE_MFA === "true",
  otpDisabled: process.env.DISABLE_OTP === "true",
  rateLimitDisabled: process.env.DISABLE_RATE_LIMIT === "true",
});
