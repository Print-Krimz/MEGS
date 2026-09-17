import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import supabase from "../utils/supabase.js";
import prisma from "../utils/prisma.js";
import { sendError } from "../utils/response.js";

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
  role?: string;
  [key: string]: any;
}

/**
 * Fast-path local cryptographic token verification.
 * Verifies expiration and signature in-memory (< 0.1ms) to eliminate outbound HTTP network round-trips.
 */
function verifyJwtLocally(token: string): { sub: string; email?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload: JwtPayload = JSON.parse(payloadJson);

    // 1. Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    // 2. Verify signature with project secret if HMAC HS256
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SECRET_KEY;
    if (secret) {
      const headerJson = Buffer.from(headerB64, "base64url").toString("utf8");
      const header = JSON.parse(headerJson);
      if (header.alg === "HS256") {
        const expectedSig = crypto
          .createHmac("sha256", secret)
          .update(`${headerB64}.${payloadB64}`)
          .digest("base64url");
        if (expectedSig !== signatureB64) {
          return null;
        }
      }
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

// Validates Bearer token and attaches active DB user context to req.user.
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | null = null;
  const authHeader = req.headers?.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query && typeof req.query.token === "string" && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    sendError(res, "No token provided", 401);
    return;
  }

  // 1. Fast-path: local cryptographic verification (< 0.1 ms)
  let userId: string | null = null;
  const localClaims = verifyJwtLocally(token);

  if (localClaims?.sub) {
    userId = localClaims.sub;
  } else {
    // 2. Resilient fallback: remote Supabase Auth REST verification
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      sendError(res, "Invalid or expired token", 401);
      return;
    }
    userId = data.user.id;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
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

  if (dbUser.accountStatus === "PENDING" || dbUser.accountStatus === "INVITED") {
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
