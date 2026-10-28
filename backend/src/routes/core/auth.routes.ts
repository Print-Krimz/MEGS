import { Router } from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  setupAccount,
  getInvitationDetails,
  claimStart,
  claimVerify,
  claimEmailCode,
  claimComplete,
} from '../../controllers/core/auth.controller.js';
import {
  enrollMfaHandler,
  verifyMfaEnrollmentHandler,
  verifyMfaLoginHandler,
  verifyMfaRecoveryHandler,
  getMfaStatusHandler,
} from '../../controllers/core/mfa.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authSchema } from '../../schemas/auth.schema.js';
import { claimSchema } from '../../schemas/claim.schema.js';
import {
  authLimiter,
  forgotPasswordLimiter,
  authIpLimiter,
  authAccountLimiter,
  claimPhoneLimiter,
} from '../../middleware/rate-limiter.middleware.js';
import { verifyTurnstile } from '../../middleware/turnstile.middleware.js';

import { continueWithoutMfa } from "../../controllers/core/mfa-continue.controller.js";
const router = Router();
router.post("/mfa/continue", authLimiter, continueWithoutMfa);
// Revocation must remain available even after the authentication budgets are exhausted.
router.post("/logout", authenticateJWT, logout);
router.use(authIpLimiter, authAccountLimiter);

// Public Auth Endpoints (Rate Limited & Bot Protected)
router.post("/register", authLimiter, verifyTurnstile, validate(authSchema.register), register);
router.post("/verify-otp", authLimiter, validate(authSchema.verifyOtp), verifyOtp);
router.post("/resend-otp", forgotPasswordLimiter, validate(authSchema.resendOtp), resendOtp);
router.post("/login", authLimiter, verifyTurnstile, validate(authSchema.login), login);
// No authLimiter: refresh has no email, so it would key by IP and cap a shared office IP at 5 per 15 minutes.
router.post("/refresh", validate(authSchema.refresh), refresh);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  verifyTurnstile,
  validate(authSchema.forgotPassword),
  forgotPassword
);
router.post("/reset-password", authLimiter, validate(authSchema.resetPassword), resetPassword);
router.get("/invitation-details", authLimiter, validate(authSchema.getInvitationDetails), getInvitationDetails);
router.post("/setup-account", authLimiter, validate(authSchema.setupAccount), setupAccount);

// Walk-in account claim (SMS code -> claim token -> optional email code -> password)
router.post("/claim/start", authLimiter, claimPhoneLimiter, verifyTurnstile, validate(claimSchema.start), claimStart);
router.post("/claim/verify", authLimiter, validate(claimSchema.verify), claimVerify);
router.post("/claim/email-code", authLimiter, validate(claimSchema.emailCode), claimEmailCode);
router.post("/claim/complete", authLimiter, validate(claimSchema.complete), claimComplete);

// MFA Endpoints (TOTP & Recovery)
router.post("/mfa/enroll", authLimiter, validate(authSchema.enrollMfa), enrollMfaHandler);
router.post(
  "/mfa/verify-enrollment",
  authLimiter,
  validate(authSchema.verifyMfaEnrollment),
  verifyMfaEnrollmentHandler
);
router.post("/mfa/verify-login", authLimiter, validate(authSchema.verifyMfaLogin), verifyMfaLoginHandler);
router.post(
  "/mfa/verify-recovery",
  authLimiter,
  validate(authSchema.verifyMfaRecovery),
  verifyMfaRecoveryHandler
);
router.get("/mfa/status", authLimiter, getMfaStatusHandler);

// Authenticated Endpoints
router.post(
  "/change-password",
  authenticateJWT,
  authLimiter,
  validate(authSchema.changePassword),
  changePassword
);

export default router;


