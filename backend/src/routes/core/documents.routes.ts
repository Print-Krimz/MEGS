import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware.js";
import { downloadDocument, previewDocument } from "../../controllers/core/document.controller.js";

const router = Router();

// GET /api/documents/:id/download
router.get("/:id/download", authenticateJWT, downloadDocument);

// GET /api/documents/:id/preview
router.get("/:id/preview", authenticateJWT, previewDocument);

export default router;

