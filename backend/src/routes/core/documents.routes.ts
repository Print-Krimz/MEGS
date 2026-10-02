import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { documentsSchema } from "../../schemas/documents.schema.js";
import { downloadDocument, previewDocument } from "../../controllers/core/document.controller.js";

const router = Router();

// GET /api/documents/:id/download
router.get("/:id/download", authenticateJWT, validate(documentsSchema.documentParams), downloadDocument);

// GET /api/documents/:id/preview
router.get("/:id/preview", authenticateJWT, validate(documentsSchema.documentParams), previewDocument);

export default router;

