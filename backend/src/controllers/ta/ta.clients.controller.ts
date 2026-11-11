import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import {
  listClients,
  createClient,
  getClientDetails,
  updateClient,
  findDuplicateClient,
  DuplicateClientError,
} from "../../services/ta/ta.clients.service.js";
import { readClientDocument } from "../../services/ta/client-read.service.js";

const sendDuplicate = (res: Response, error: DuplicateClientError) =>
  sendError(res, error.message, 409, { errors: [{ field: error.field, message: error.message }] });

export const listClientsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;
    const clients = await listClients(isActive, req.user);
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

    const client = await createClient(req.body, req.user);
    sendSuccess(res, "Client created successfully", client, 201);
  } catch (error: any) {
    if (error instanceof DuplicateClientError) return void sendDuplicate(res, error);
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

    const updated = await updateClient(id, req.body, req.user);
    sendSuccess(res, "Client updated successfully", updated);
  } catch (error: any) {
    if (error instanceof DuplicateClientError) return void sendDuplicate(res, error);
    const status = error.message.includes("not found") ? 404 : 400;
    sendError(res, error.message, status);
  }
};

// POST /api/ta/clients/read (multipart, file field "file"). Reads the document with AI; saves nothing.
export const readClientFile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      sendError(res, "Attach the client document (PDF, Word file or photo)", 400);
      return;
    }
    sendSuccess(res, "Client document read", await readClientDocument(req.file));
  } catch (error: any) {
    // Only an unsupported or oversized file reaches here; a reading failure returns UNREADABLE instead.
    sendError(res, error.message, 400, error);
  }
};

// GET /api/ta/clients/check-duplicate?name=&tradeName= (checks every client, not only the caller's)
export const checkClientDuplicateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, tradeName } = req.query as Record<string, string | undefined>;
    sendSuccess(res, "Duplicate check complete", { match: await findDuplicateClient({ name, tradeName }, req.user) });
  } catch (error: any) {
    sendError(res, error.message, 400, error);
  }
};
