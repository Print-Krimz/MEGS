import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  registerUser,
  verifyOtp as verifyOtpService,
  resendOtp as resendOtpService,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
  changeUserPassword,
  setupAccount as setupAccountService,
  getInvitationDetails as getInvitationDetailsService,
} from '../../services/core/auth.service.js';

// POST /api/auth/register - Creates Supabase auth credentials, local User record (PENDING_VERIFICATION), and dispatches 6-digit OTP
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await registerUser(email, password);
    sendSuccess(res, user.message, user, 201);
  } catch (error: any) {
    const status = error.message.includes("already exists") ? 409 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/verify-otp - Validates 6-digit OTP for Registration or Password Reset
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, otp, purpose } = req.body;

  try {
    const result = await verifyOtpService(email, otp, purpose);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/resend-otp - Resends a new 6-digit OTP with 60-second cooldown protection
export const resendOtp = async (req: Request, res: Response): Promise<void> => {
  const { email, purpose } = req.body;

  try {
    const result = await resendOtpService(email, purpose);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    const isCooldown = error.message.includes("Please wait");
    const status = isCooldown ? 429 : error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/login - Authenticates via Supabase Auth and returns role from DB
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const session = await loginUser(email, password, req.ip);
    sendSuccess(res, "Login successful", session);
  } catch (error: any) {
    const status = error.message.includes("verify your email") ? 403 : 401;
    sendError(res, error.message, status);
  }
};

// POST /api/auth/logout - Invalidates Supabase session server-side
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    await logoutUser(token, req.user?.id);
    sendSuccess(res, "Logged out successfully", null);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/auth/forgot-password - Generates 6-digit numeric OTP & sends via email (generic response)
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const result = await requestPasswordReset(email);
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



