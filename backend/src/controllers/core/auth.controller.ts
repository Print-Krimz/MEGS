import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { revokeSession } from '../../security/session-revocation.js';
import { notificationEmitter } from '../../utils/notification.js';
import {
  registerUser,
  verifyOtp as verifyOtpService,
  resendOtp as resendOtpService,
  loginUser,
  refreshUserSession,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
  changeUserPassword,
  setupAccount as setupAccountService,
  getInvitationDetails as getInvitationDetailsService,
  ClaimError,
  startAccountClaim,
  verifyAccountClaim,
  sendAccountClaimEmailCode,
  completeAccountClaim,
} from '../../services/core/auth.service.js';

// POST /api/auth/register - Creates Supabase auth credentials, local User record (PENDING_VERIFICATION), and dispatches 6-digit OTP
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, identifier, password } = req.body;
  const target = identifier || email;

  try {
    const user = await registerUser(target, password);
    sendSuccess(res, user.message, user, 201);
  } catch (error: any) {
    if (error?.code === "ACCOUNT_CLAIMABLE") {
      // The Register page reads error.code to offer the claim page.
      res.status(409).json({ success: false, message: error.message, error: { code: "ACCOUNT_CLAIMABLE" } });
      return;
    }
    const status = error.message.includes("already exists") ? 409 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/verify-otp - Validates 6-digit OTP for Registration or Password Reset
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, identifier, otp, purpose } = req.body;
  const target = identifier || email;

  try {
    const result = await verifyOtpService(target, otp, purpose);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/resend-otp - Resends a new 6-digit OTP with 60-second cooldown protection
export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, identifier, purpose } = req.body;
  const target = identifier || email;

  try {
    const result = await resendOtpService(target, purpose);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    const isCooldown = error.message.includes("Please wait");
    const status = isCooldown ? 429 : error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/login - Authenticates via Supabase Auth and returns role from DB
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, identifier, password } = req.body;
  const target = identifier || email;

  try {
    const session = await loginUser(target, password, req.ip);
    sendSuccess(res, "Login successful", session);
  } catch (error: any) {
    const status = error.message.includes("verify") ? 403 : 401;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/refresh - Exchanges a refresh token for a new session (access token is expired, so unauthenticated)
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const session = await refreshUserSession(req.body.refresh_token);
    if (!session) {
      sendError(res, "Session expired. Please log in again.", 401);
      return;
    }
    sendSuccess(res, "Session refreshed", session);
  } catch {
    sendError(res, "Session expired. Please log in again.", 401);
  }
};

// POST /api/auth/logout - Invalidates Supabase session server-side
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
    if (!token || !Number.isFinite(req.user?.tokenExpiresAt)) {
      sendError(res, "Invalid or expired token", 401);
      return;
    }
    await revokeSession(token, req.user!.tokenExpiresAt!);
    // Only "idle" is recognised; anything else is an ordinary sign-out.
    if (req.body?.reason === "idle") await logoutUser(token, req.user?.id, "idle");
    else await logoutUser(token, req.user?.id);
    if (req.user) notificationEmitter.emit(`session:closed:${req.user.id}`);
    sendSuccess(res, "Logged out successfully", null);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/auth/forgot-password - Generates 6-digit numeric OTP & sends via email/SMS (generic response)
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email, identifier } = req.body;
  const target = identifier || email;

  try {
    const result = await requestPasswordReset(target);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    const isCooldown = error.message.includes("Please wait");
    const status = isCooldown ? 429 : 500;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/reset-password - Sets new password using reset token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  try {
    const result = await resetUserPassword(token, password);
    sendSuccess(res, result.message, null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// POST /api/auth/change-password - Authenticated user changes own password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body;

  try {
    const result = await changeUserPassword(userId, currentPassword, newPassword);
    sendSuccess(res, result.message, null);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// POST /api/auth/setup-account - Invited TA sets password to activate account
export const setupAccount = async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  try {
    const result = await setupAccountService(token, password);
    sendSuccess(res, result.message, result.user);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

// GET /api/auth/invitation-details - Retrieve masked email and token validity for TA setup
export const getInvitationDetails = async (req: Request, res: Response): Promise<void> => {
  const token = (req.query.token || req.body?.token) as string;

  try {
    const result = await getInvitationDetailsService(token);
    sendSuccess(res, "Invitation details retrieved successfully", result);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};




const claimFailure = (res: Response, error: unknown): void => {
  if (error instanceof ClaimError) {
    sendError(res, error.message, error.status);
    return;
  }
  sendError(res, "Unable to process the claim request", 500, error);
};

// POST /api/auth/claim/start - Texts a code when a walk-in profile owns the phone. Always the same answer.
export const claimStart = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await startAccountClaim(req.body.phone);
    sendSuccess(res, result.message, result);
  } catch (error) {
    claimFailure(res, error);
  }
};

// POST /api/auth/claim/verify - Trades the SMS code for a 15-minute claim token
export const claimVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await verifyAccountClaim(req.body.phone, req.body.otp);
    sendSuccess(res, "Mobile number verified.", result);
  } catch (error) {
    claimFailure(res, error);
  }
};

// POST /api/auth/claim/email-code - Emails a code for the address to add to the account
export const claimEmailCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await sendAccountClaimEmailCode(req.body.claimToken, req.body.email);
    sendSuccess(res, result.message, result);
  } catch (error) {
    claimFailure(res, error);
  }
};

// POST /api/auth/claim/complete - Sets the password (and email) and activates the account
export const claimComplete = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await completeAccountClaim(req.body);
    sendSuccess(res, result.message, result);
  } catch (error) {
    claimFailure(res, error);
  }
};
