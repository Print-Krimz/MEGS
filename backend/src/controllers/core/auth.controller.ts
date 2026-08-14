import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  registerUser,
  loginUser,
  logoutUser,
  requestPasswordReset,
  resetUserPassword,
  changeUserPassword,
  setupAccount as setupAccountService,
} from '../../services/core/auth.service.js';

// POST /api/auth/register - Creates Supabase auth credentials and local User record (APPLICANT only)
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await registerUser(email, password);
    sendSuccess(res, "Account created successfully", user, 201);
  } catch (error: any) {
    const status = error.message.includes("already exists") ? 409 : 400;
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
    sendError(res, error.message, 401);
  }
};

// POST /api/auth/logout - Invalidates Supabase session server-side
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    await logoutUser(token);
    sendSuccess(res, "Logged out successfully", null);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/auth/forgot-password - Generates secure link & sends via Resend (generic response)
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  try {
    const result = await requestPasswordReset(email);
    sendSuccess(res, result.message, result);
  } catch (error: any) {
    sendError(res, error.message, 500);
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

