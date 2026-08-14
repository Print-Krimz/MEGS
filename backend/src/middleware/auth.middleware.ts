import { Request, Response, NextFunction } from "express";
import supabase from "../utils/supabase.js";
import prisma from "../utils/prisma.js";
import { sendError } from "../utils/response.js";

// Validates Bearer token via Supabase Auth and attaches active DB user context to req.user.
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    sendError(res, "No token provided", 401);
    return;
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    sendError(res, "Invalid or expired token", 401);
    return;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: data.user.id },
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

  if (!dbUser.isActive || dbUser.accountStatus === "DEACTIVATED") {
    sendError(res, "Account has been deactivated", 403);
    return;
  }

  if (dbUser.accountStatus === "INVITED") {
    sendError(res, "Account setup has not been completed", 403);
    return;
  }

  req.user = {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    mustChangePassword: dbUser.mustChangePassword,
    accountStatus: dbUser.accountStatus,
  };

  // Enforce password change before any other action except password change or logout
  if (dbUser.mustChangePassword) {
    const isAllowedPath =
      req.path.endsWith("/change-password") ||
      req.path.endsWith("/logout") ||
      req.originalUrl?.includes("/api/auth/change-password") ||
      req.originalUrl?.includes("/api/auth/logout");

    if (!isAllowedPath) {
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
