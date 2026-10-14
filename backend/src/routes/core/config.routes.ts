import { Router } from "express";
import { getGlobalConfig, getSecurityStatus } from "../../controllers/core/config.controller.js";

const router = Router();

router.get("/", getGlobalConfig);
// Read-only demo status; this endpoint cannot change backend configuration.
router.get("/security", getSecurityStatus);

export default router;
