import { Router } from "express";
import {
  register,
  verifyOtp,
  resendOtp,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  setupAccount,
  getInvitationDetails,
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
import {
  authLimiter,
  forgotPasswordLimiter,
} from '../../middleware/rate-limiter.middleware.js';

const router = Router();

// Public Auth Endpoints (Rate Limited)
router.post("/register", authLimiter, validate(authSchema.register), register);
router.post("/verify-otp", authLimiter, validate(authSchema.verifyOtp), verifyOtp);
router.post("/resend-otp", forgotPasswordLimiter, validate(authSchema.resendOtp), resendOtp);
router.post("/login", authLimiter, validate(authSchema.login), login);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validate(authSchema.forgotPassword),
  forgotPassword
);
router.post("/reset-password", authLimiter, validate(authSchema.resetPassword), resetPassword);
router.get("/invitation-details", authLimiter, validate(authSchema.getInvitationDetails), getInvitationDetails);
router.post("/setup-account", authLimiter, validate(authSchema.setupAccount), setupAccount);

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
router.post("/logout", authenticateJWT, logout);

export default router;


