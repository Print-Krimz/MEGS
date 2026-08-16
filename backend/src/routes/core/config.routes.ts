import { Router } from "express";
import { getGlobalConfig } from "../../controllers/core/config.controller.js";

const router = Router();

router.get("/", getGlobalConfig);

export default router;
