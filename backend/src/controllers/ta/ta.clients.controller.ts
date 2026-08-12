import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  listClients,
  createClient,
  getClientDetails,
  updateClient,
} from "../../services/ta/ta.clients.service.js";

export const listClientsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
    const clients = await listClients(isActive);
    sendSuccess(res, "Clients retrieved successfully", clients);
  } catch (error: any) {
    sendError(res, error.message, 500);
  }
};

export const createClientHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      sendError(res, "Client name is required", 400);
      return;
    }

    const client = await createClient(req.body);
    sendSuccess(res, "Client created successfully", client, 201);
  } catch (error: any) {
    sendError(res, error.message, 400);
  }
};

export const getClientDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid client ID", 400);
      return;
    }

    const client = await getClientDetails(id);
    sendSuccess(res, "Client details retrieved successfully", client);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

export const updateClientHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      sendError(res, "Invalid client ID", 400);
      return;
    }

    const updated = await updateClient(id, req.body);
    sendSuccess(res, "Client updated successfully", updated);
  } catch (error: any) {
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};
