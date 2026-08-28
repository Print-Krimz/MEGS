import { Request, Response } from "express";
import { sendSuccess, sendError } from '../../utils/response.js';
import { savePostHireDocument } from '../../services/ta/ta.posthire.service.js';

// POST /api/ta/applications/:id/documents - Upload post-hire compliance documents (medical, NBI, contract)
export const uploadPostHireDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const applicationId = parseInt(req.params.id as string);
    if (isNaN(applicationId)) {
      sendError(res, "Invalid application ID", 400);
      return;
    }
    const { label, notes } = req.body;
    if (!label) {
      sendError(res, "Label is required (e.g., 'Medical Certificate')", 400);
      return;
    }
    const document = await savePostHireDocument(applicationId, label, req.file, notes);
    sendSuccess(res, "Post-hire document uploaded successfully", document, 201);
  } catch (error: any) {
    const statusCode = error.message.includes("not found") ? 404 :
                       error.message.includes("No file") ? 400 : 500;
    sendError(res, error.message, statusCode);
  }
};
