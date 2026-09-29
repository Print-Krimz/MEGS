import { Request, Response, NextFunction } from "express";
import prisma from "../utils/prisma.js";
import { sendError } from "../utils/response.js";
import { verifyAccessToken } from "../security/auth-token.js";
import {
  isActiveAccount,
  isMfaEnforced,
  isPasswordChangeAllowedRoute,
  isStaffMfaExceptionRoute,
  STAFF_ROLES,
} from "../security/auth-policy.js";

// Validates Bearer token and attaches active DB user context to req.user.
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.match(/^Bearer\s+([^\s]+)$/i)?.[1] || null;

  if (!token) {
    sendError(res, "No token provided", 401);
    return;
  }

  let verifiedToken;
  try {
    verifiedToken = await verifyAccessToken(token);
  } catch {
    sendError(res, "Invalid or expired token", 401);
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: verifiedToken.sub },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      accountStatus: true,
      mustChangePassword: true,
    },
  });

  if (!dbUser) {
    sendError(res, "User account not found", 401);
    return;
  }

  if (!isActiveAccount(dbUser.isActive, dbUser.accountStatus)) {
    sendError(res, "Account is not active", 403);
    return;
  }

  req.user = {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    mustChangePassword: dbUser.mustChangePassword,
    accountStatus: dbUser.accountStatus,
    aal: verifiedToken.aal,
  };

  if (
    isMfaEnforced() &&
    STAFF_ROLES.has(dbUser.role) &&
    verifiedToken.aal !== "aal2" &&
    !isStaffMfaExceptionRoute(req)
  ) {
    sendError(res, "Multi-factor authentication is required", 403);
    return;
  }

  // Enforce password change before any other action except password change or logout
  if (dbUser.mustChangePassword) {
    if (!isPasswordChangeAllowedRoute(req)) {
      res.status(403).json({
        success: false,
        message: "You must change your password before proceeding",
        mustChangePassword: true,
      });
      return;
    }
  }

  next();
};

// RBAC middleware restricting route access to specified roles (requires prior authenticateJWT).
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, "You do not have permission to access this resource", 403);
      return;
    }

    next();
  };
};
