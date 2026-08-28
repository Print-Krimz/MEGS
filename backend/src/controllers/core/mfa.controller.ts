import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../../utils/response.js';
import supabase from '../../utils/supabase.js';
import prisma from '../../utils/prisma.js';
import {
  enrollMfa as enrollMfaService,
  verifyMfaEnrollment as verifyMfaEnrollmentService,
  verifyMfaLogin as verifyMfaLoginService,
  verifyRecoveryCode as verifyRecoveryCodeService,
  getUserMfaFactors,
  resetUserMfa as resetUserMfaService,
} from '../../services/core/mfa.service.js';

const extractToken = (req: Request): string => {
  // If explicitly passed in the request body (e.g. from setup account or challenge modal), prioritize it
  if (req.body?.token && typeof req.body.token === 'string' && req.body.token.trim()) {
    return req.body.token.trim();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return '';
};

export const enrollMfaHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      sendError(res, 'Authentication token is required for MFA enrollment', 401);
      return;
    }

    const result = await enrollMfaService(token);
    sendSuccess(res, 'MFA enrollment initialized', result);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to initialize MFA enrollment', 400);
  }
};

export const verifyMfaEnrollmentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractToken(req);
    const { factorId, code } = req.body;

    if (!token) {
      sendError(res, 'Authentication token is required', 401);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      sendError(res, 'Invalid or expired session token', 401);
      return;
    }

    const userId = userData.user.id;
    const result = await verifyMfaEnrollmentService(token, userId, factorId, code);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        mustChangePassword: true,
      },
    });

    sendSuccess(res, result.message, {
      recoveryCodes: result.recoveryCodes,
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
      expires_in: result.session.expires_in,
      user: dbUser,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Failed to verify MFA enrollment', 400);
  }
};

export const verifyMfaLoginHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractToken(req);
    const { factorId, challengeId, code } = req.body;

    if (!token) {
      sendError(res, 'Authentication token is required', 401);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      sendError(res, 'Invalid or expired session token', 401);
      return;
    }

    const userId = userData.user.id;
    const session = await verifyMfaLoginService(token, factorId, challengeId, code, userId);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        mustChangePassword: true,
      },
    });

    sendSuccess(res, 'Authentication verified successfully', {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      user: dbUser,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Invalid authentication code', 401);
  }
};

export const verifyMfaRecoveryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractToken(req);
    const { recoveryCode } = req.body;

    if (!token) {
      sendError(res, 'Authentication token is required', 401);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      sendError(res, 'Invalid or expired session token', 401);
      return;
    }

    const userId = userData.user.id;
    const recoveryResult = await verifyRecoveryCodeService(userId, recoveryCode);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
        mustChangePassword: true,
      },
    });

    sendSuccess(res, 'Recovery code verified successfully', {
      access_token: token,
      remainingRecoveryCodes: recoveryResult.remainingCodes,
      user: dbUser,
    });
  } catch (error: any) {
    sendError(res, error.message || 'Invalid recovery code', 401);
  }
};

export const getMfaStatusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) {
      sendError(res, 'Authentication token is required', 401);
      return;
    }

    const status = await getUserMfaFactors(token);
    sendSuccess(res, 'MFA status retrieved', status);
  } catch (error: any) {
    sendError(res, error.message || 'Failed to retrieve MFA status', 500);
  }
};
