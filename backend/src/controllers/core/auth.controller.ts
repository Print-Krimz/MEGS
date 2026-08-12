import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { registerUser, loginUser, logoutUser } from '../../services/core/auth.service.js';

// POST /api/auth/register - Creates Supabase auth credentials and local User record
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

// POST /api/auth/login - Authenticates via Supabase Auth and issues JWT session
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
