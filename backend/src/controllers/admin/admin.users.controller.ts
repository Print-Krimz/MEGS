import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  fetchAllUsers,
  changeUserRole,
  changeUserStatus
} from '../../services/admin/admin.service.js';

// GET /api/admin/users - List users and applicant profiles
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await fetchAllUsers();
    sendSuccess(res, "Users retrieved successfully", users);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// PATCH /api/admin/users/:id/role - Update user role (prevents self-demotion)
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const adminId = req.user!.id;
    const { role } = req.body;
    
    const updatedUser = await changeUserRole(targetUserId, adminId, role);
    sendSuccess(res, "User role updated successfully", updatedUser);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 :
                       error.message.includes("Security constraint") ? 403 : 400;
    sendError(res, error.message, statusCode);
  }
};

// PATCH /api/admin/users/:id/status - Toggle account active status (prevents self-deactivation)
export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const adminId = req.user!.id;
    const { isActive } = req.body;
    
    const updatedUser = await changeUserStatus(targetUserId, adminId, isActive);
    const actionText = isActive ? "reactivated" : "deactivated";
    sendSuccess(res, `User successfully ${actionText}`, updatedUser);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 :
                       error.message.includes("Security constraint") ? 403 : 400;
    sendError(res, error.message, statusCode);
  }
};
