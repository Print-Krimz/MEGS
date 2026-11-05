import { Request, Response } from "express";
import { getDocumentDownloadUrl, getDocumentPreview } from "../../services/document/document.service.js";
import { sendSuccess, sendError } from "../../utils/response.js";

// GET /api/documents/:id/download - Redirects authenticated caller to signed Supabase storage URL
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id as string, 10);
    if (isNaN(documentId)) {
      sendError(res, "Invalid document ID", 400);
      return;
    }

    const url = await getDocumentDownloadUrl(documentId, req.user!.id, req.user!.role);
    res.redirect(url);
  } catch (error: any) {
    const statusCode = error.message.includes("Unauthorized") ? 403 : 404;
    sendError(res, error.message, statusCode);
  }
};

// GET /api/documents/:id/preview - Returns JSON with signed URL and document metadata
export const previewDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id as string, 10);
    if (isNaN(documentId)) {
      sendError(res, "Invalid document ID", 400);
      return;
    }

    const preview = await getDocumentPreview(documentId, req.user!.id, req.user!.role);
    sendSuccess(res, "Document preview retrieved successfully", preview);
  } catch (error: any) {
    const statusCode = error.message.includes("Unauthorized") ? 403 : 404;
    sendError(res, error.message, statusCode);
  }
};

