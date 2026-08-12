import { Router } from "express";
import { authenticateJWT } from "../../middleware/auth.middleware.js";
import { downloadDocument } from "../../controllers/core/document.controller.js";

const router = Router();

// GET /api/documents/:id/download
router.get("/:id/download", authenticateJWT, downloadDocument);

export default router;
