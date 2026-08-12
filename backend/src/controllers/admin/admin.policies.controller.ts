import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import {
  fetchPolicies,
  createNewPolicy,
  updateExistingPolicy,
  deleteExistingPolicy
} from '../../services/admin/admin.service.js';

// GET /api/admin/policies - List all dynamic system configuration policies
export const listPolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const policies = await fetchPolicies();
    sendSuccess(res, "Policies retrieved successfully", policies);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

// POST /api/admin/policies - Create system policy and invalidate cache
export const createPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { key, value, description } = req.body;
    const policy = await createNewPolicy(key, value, description);
    sendSuccess(res, "Policy created successfully", policy, 201);
  } catch (error: any) {
    const status = error.message.includes("exists") || error.message.includes("required") ? 400 : 500;
    sendError(res, error.message, status);
  }
};

// PATCH /api/admin/policies/:key - Update policy value/description and invalidate cache
export const updatePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;
    const { value, description } = req.body;
    const policy = await updateExistingPolicy(key, value, description);
    sendSuccess(res, "Policy updated successfully", policy);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// DELETE /api/admin/policies/:key - Delete policy and invalidate cache
export const deletePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const key = req.params.key as string;
    await deleteExistingPolicy(key);
    sendSuccess(res, "Policy deleted successfully", null);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};
