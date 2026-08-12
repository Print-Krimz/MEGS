import { Router } from "express";
import { register, login, logout } from '../../controllers/core/auth.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authSchema } from '../../schemas/auth.schema.js';

const router = Router();

router.post("/register", validate(authSchema.register), register);
router.post("/login", validate(authSchema.login), login);
router.post("/logout", authenticateJWT, logout);

export default router;
