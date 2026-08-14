import { Router } from "express";
import {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  setupAccount,
} from '../../controllers/core/auth.controller.js';
import { authenticateJWT } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authSchema } from '../../schemas/auth.schema.js';

const router = Router();

// Public Auth Endpoints
router.post("/register", validate(authSchema.register), register);
router.post("/login", validate(authSchema.login), login);
router.post("/forgot-password", validate(authSchema.forgotPassword), forgotPassword);
router.post("/reset-password", validate(authSchema.resetPassword), resetPassword);
router.post("/setup-account", validate(authSchema.setupAccount), setupAccount);

// Authenticated Endpoints
router.post("/change-password", authenticateJWT, validate(authSchema.changePassword), changePassword);
router.post("/logout", authenticateJWT, logout);

export default router;

