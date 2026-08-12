import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  createDeployment,
  updateDeploymentStatus,
  listDeployments,
  getDeploymentDetails,
} from "../../services/ta/ta.deployments.service.js";

export const createDeploymentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string, 10);
    const { clientId, mrfId, site, contractStart, contractEnd, notes } = req.body;

    if (isNaN(applicationId) || !clientId) {
      sendError(res, "applicationId and clientId are required", 400);
      return;
    }

    const deployment = await createDeployment(req.user!.id, {
      applicationId,
      clientId: parseInt(clientId, 10),
      mrfId: mrfId ? parseInt(mrfId, 10) : undefined,
      site,
      contractStart,
      contractEnd,
      notes,
    });

    sendSuccess(res, "Deployment created successfully", deployment, 201);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

export const updateDeploymentStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, notes } = req.body;

    if (isNaN(id) || !status) {
      sendError(res, "deployment ID and status are required", 400);
      return;
    }

    const updated = await updateDeploymentStatus(id, status, notes);
    sendSuccess(res, "Deployment status updated successfully", updated);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, statusCode);
  }
};

export const listDeploymentsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = req.query.clientId ? parseInt(req.query.clientId as string, 10) : undefined;
    const status = req.query.status as string | undefined;

    const deployments = await listDeployments(clientId, status);
    sendSuccess(res, "Deployments retrieved successfully", deployments);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const getDeploymentDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid deployment ID", 400);
      return;
    }

    const deployment = await getDeploymentDetails(id);
    sendSuccess(res, "Deployment details retrieved successfully", deployment);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};
