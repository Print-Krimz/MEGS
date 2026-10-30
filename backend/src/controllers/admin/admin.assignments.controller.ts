import { Request, Response } from "express";
import { sendSuccess, sendError } from "../../utils/response.js";
import { assignClient, assignMrf, reassignTaRecords } from "../../services/admin/assignment.service.js";
import { getTAApplication } from "../../services/ta/ta.applications.service.js";

const fail = (res: Response, error: any) => sendError(res, error.message, error.message.includes("not found") ? 404 : 400);

// GET /api/admin/applications/:id - read-only application detail for oversight links
export const getAdminApplicationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Application retrieved", await getTAApplication(Number(req.params.id)));
  } catch (error: any) {
    fail(res, error);
  }
};

// PATCH /api/admin/mrfs/:id/assignment
export const assignMrfHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Requisition owner updated", await assignMrf(Number(req.params.id), req.body.assignedTaId, req.user!.id));
  } catch (error: any) {
    fail(res, error);
  }
};

// PATCH /api/admin/clients/:id/assignment
export const assignClientHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Client owner updated", await assignClient(Number(req.params.id), req.body.assignedTaId, req.user!.id));
  } catch (error: any) {
    fail(res, error);
  }
};

// POST /api/admin/users/:id/reassign-records
export const reassignTaRecordsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    sendSuccess(res, "Records reassigned", await reassignTaRecords(String(req.params.id), req.body.toTaId, req.user!.id));
  } catch (error: any) {
    fail(res, error);
  }
};
