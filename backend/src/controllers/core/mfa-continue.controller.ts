import type { Request, Response } from "express";
import prisma from "../../utils/prisma.js";
import { verifyAccessToken } from "../../security/auth-token.js";
import { isSessionRevoked } from "../../security/session-revocation.js";
import { getSecurityControls } from "../../security/security-controls.js";
import { isActiveAccount, STAFF_ROLES } from "../../security/auth-policy.js";
import { sendError, sendSuccess } from "../../utils/response.js";

// Continue an existing password-authenticated session when the admin disables
// MFA during a pending enrollment/challenge. Never fabricate an AAL2 claim.
export const continueWithoutMfa = async (req: Request, res: Response) => {
  const token = req.body?.token;
  if (typeof token !== "string" || !token) { sendError(res, "No token provided", 401); return; }
  let claims;
  try { claims = await verifyAccessToken(token); }
  catch { sendError(res, "Invalid or expired token", 401); return; }
  if (await isSessionRevoked(token)) { sendError(res, "Invalid or expired token", 401); return; }
  const user = await prisma.user.findUnique({ where: { id: claims.sub }, select: {
    id: true, email: true, role: true, isActive: true, accountStatus: true, mustChangePassword: true,
  } });
  if (!user || !isActiveAccount(user.isActive, user.accountStatus) || !STAFF_ROLES.has(user.role)) {
    sendError(res, "Account is not active", 403); return;
  }
  if (!(await getSecurityControls()).mfaDisabled) {
    sendError(res, "Multi-factor authentication is required", 403); return;
  }
  sendSuccess(res, "Continue with the existing authenticated session", {
    access_token: token, expires_in: Math.max(0, claims.exp - Math.floor(Date.now() / 1000)), user,
  });
};
