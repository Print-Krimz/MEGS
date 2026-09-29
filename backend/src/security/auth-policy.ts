import type { Request } from "express";

export const STAFF_ROLES = new Set(["ADMINISTRATOR", "TALENT_ACQUISITION"]);

const routeKey = (req: Pick<Request, "method" | "baseUrl" | "path">): string =>
  `${req.method.toUpperCase()} ${req.baseUrl}${req.path}`;

export const isPasswordChangeAllowedRoute = (
  req: Pick<Request, "method" | "baseUrl" | "path">
): boolean => {
  const key = routeKey(req);
  return key === "POST /api/auth/change-password" || key === "POST /api/auth/logout";
};

export const isStaffMfaExceptionRoute = (
  req: Pick<Request, "method" | "baseUrl" | "path">
): boolean => routeKey(req) === "POST /api/auth/logout";

export const isActiveAccount = (isActive: boolean, accountStatus: string): boolean =>
  isActive && accountStatus === "ACTIVE";
